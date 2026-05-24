"""Daily Bitfinex funding pipeline.

每日（默认 01:35 UTC）跑一次：拉前一日 funding 收益 → 计算 NAV → 扣平台费 → 发 treasury 份额 → 写用户份额快照。

可重入：同一日期重跑会先清掉旧数据再算。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.encryption import decrypt
from app.models.bitfinex_account import BitfinexAccount
from app.models.daily_nav import DailyNav
from app.models.funding_record import FundingRecord
from app.models.product_config import get_current_config
from app.models.share_transaction import ShareChangeType, ShareTransaction
from app.models.user import User, UserRole
from app.models.user_share_snapshot import UserShareSnapshot
from app.services.bitfinex_client import BitfinexClient, FundingPaymentRow

logger = logging.getLogger(__name__)

# 我们关心的两种币种（合并入池估值，UST 视为 1:1 USD）
SUPPORTED_CURRENCIES = ("USD", "UST")
INITIAL_NAV = Decimal("1.0")


@dataclass(frozen=True)
class NavComputation:
    gross_nav: Decimal
    final_nav: Decimal
    platform_fee: Decimal
    admin_shares_issued: Decimal
    aum_after: Decimal
    shares_after: Decimal


def compute_nav_step(
    *,
    aum_before: Decimal,
    shares_before: Decimal,
    raw_earnings: Decimal,
    fee_threshold_apy: Decimal,
    fee_rate: Decimal,
) -> NavComputation:
    """纯函数：根据期初状态和当日 raw 收益算 NAV、平台费、admin 新份额。

    阶梯规则：
      threshold = aum_before * fee_threshold_apy / 365
      excess = max(0, raw_earnings - threshold)
      platform_fee = excess * fee_rate
      admin_shares_issued = platform_fee / gross_nav
    """
    if shares_before <= 0:
        raise ValueError("shares_before must be > 0 to compute NAV")
    gross_nav = (aum_before + raw_earnings) / shares_before
    threshold = aum_before * fee_threshold_apy / Decimal(365)
    excess = max(Decimal(0), raw_earnings - threshold)
    platform_fee = excess * fee_rate
    admin_shares_issued = platform_fee / gross_nav if gross_nav > 0 else Decimal(0)
    shares_after = shares_before + admin_shares_issued
    aum_after = aum_before + raw_earnings
    final_nav = aum_after / shares_after if shares_after > 0 else gross_nav
    return NavComputation(
        gross_nav=gross_nav,
        final_nav=final_nav,
        platform_fee=platform_fee,
        admin_shares_issued=admin_shares_issued,
        aum_after=aum_after,
        shares_after=shares_after,
    )


class PipelineError(Exception):
    """跑批失败的统一错误。"""


# ──────────────────────────────────────────────────────────────────────────────
# 主入口
# ──────────────────────────────────────────────────────────────────────────────


def run_pipeline_for_date(
    db: Session,
    target_date: date,
    *,
    client_factory=None,
) -> DailyNav | None:
    """跑 target_date 的完整 pipeline。

    Args:
        db: SQLAlchemy session（外部 caller 负责 commit / rollback）
        target_date: UTC 自然日
        client_factory: 用于注入 BitfinexClient，方便测试 mock。
                        签名 `(account: BitfinexAccount) -> BitfinexClient`。
                        默认用真实凭证 + Fernet 解密。

    Returns:
        新建的 DailyNav 行；如果当日 shares_before==0 就跳过 NAV，返回 None
    """
    if target_date > datetime.now(UTC).date():
        raise PipelineError(f"target_date {target_date} 在未来，拒绝跑批")

    factory = client_factory or _default_client_factory

    # 1. 幂等清理
    _purge_date(db, target_date)

    # 2. 拉数据并写 funding_records
    total_raw = _fetch_and_store_funding(db, target_date, factory)

    # 3. 取期初状态
    aum_before, shares_before, user_shares = _state_before(db, target_date)
    if shares_before == 0:
        logger.info(
            "Pipeline %s: 没有用户份额，跳过 NAV 计算（funding_records 已入库）", target_date
        )
        return None

    # 4. 计算 NAV + 平台费
    cfg_threshold = _config_or_raise(db, "fee_threshold_apy", target_date)
    cfg_rate = _config_or_raise(db, "fee_rate", target_date)
    comp = compute_nav_step(
        aum_before=aum_before,
        shares_before=shares_before,
        raw_earnings=total_raw,
        fee_threshold_apy=cfg_threshold,
        fee_rate=cfg_rate,
    )

    # 5. 写 daily_nav
    nav = DailyNav(
        date=target_date,
        total_raw_earnings=total_raw,
        platform_fee=comp.platform_fee,
        gross_nav=comp.gross_nav,
        final_nav=comp.final_nav,
        total_aum_before=aum_before,
        total_aum_after=comp.aum_after,
        total_shares_before=shares_before,
        total_shares_after=comp.shares_after,
        admin_shares_issued=comp.admin_shares_issued,
        fee_threshold_apy_used=cfg_threshold,
        fee_rate_used=cfg_rate,
    )
    db.add(nav)

    # 6. 给 treasury 发份额（如果有的话）
    admin_shares_issued = comp.admin_shares_issued
    final_nav = comp.final_nav
    if admin_shares_issued > 0:
        treasury = _get_treasury_user(db)
        db.add(
            ShareTransaction(
                user_id=treasury.id,
                change_amount=admin_shares_issued,
                change_type=ShareChangeType.fee_issuance.value,
                reason=f"Platform fee for {target_date.isoformat()}",
                operator_id=None,
                related_date=target_date,
            )
        )
        user_shares[treasury.id] = user_shares.get(treasury.id, Decimal(0)) + admin_shares_issued

    # 7. 写每个有份额的用户当日 snapshot
    for user_id, shares in user_shares.items():
        if shares > 0:
            db.add(
                UserShareSnapshot(
                    user_id=user_id,
                    date=target_date,
                    shares=shares,
                    share_value=shares * final_nav,
                )
            )

    logger.info(
        "Pipeline %s: raw=%s fee=%s gross_nav=%s final_nav=%s admin_shares=%s",
        target_date,
        total_raw,
        comp.platform_fee,
        comp.gross_nav,
        comp.final_nav,
        comp.admin_shares_issued,
    )
    return nav


# ──────────────────────────────────────────────────────────────────────────────
# 辅助函数
# ──────────────────────────────────────────────────────────────────────────────


def _default_client_factory(account: BitfinexAccount) -> BitfinexClient:
    return BitfinexClient(
        api_key=decrypt(account.api_key_encrypted),
        api_secret=decrypt(account.api_secret_encrypted),
    )


def _purge_date(db: Session, target_date: date) -> None:
    """删掉 target_date 已有的 funding_records / daily_nav / fee_issuance txn / snapshots，便于重跑。"""
    db.query(UserShareSnapshot).filter(UserShareSnapshot.date == target_date).delete(
        synchronize_session=False
    )
    db.query(ShareTransaction).filter(
        ShareTransaction.related_date == target_date,
        ShareTransaction.change_type == ShareChangeType.fee_issuance.value,
    ).delete(synchronize_session=False)
    db.query(DailyNav).filter(DailyNav.date == target_date).delete(synchronize_session=False)
    db.query(FundingRecord).filter(FundingRecord.date == target_date).delete(
        synchronize_session=False
    )
    db.flush()


def _fetch_and_store_funding(
    db: Session, target_date: date, factory
) -> Decimal:
    """拉所有 active 账号的 USD/UST funding 流水入库，返回汇总 raw_earnings。"""
    accounts = (
        db.query(BitfinexAccount).filter(BitfinexAccount.active.is_(True)).all()
    )
    if not accounts:
        logger.warning("没有 active 的 bitfinex_accounts，raw_earnings = 0")
        return Decimal(0)

    total = Decimal(0)
    for account in accounts:
        client = factory(account)
        for currency in SUPPORTED_CURRENCIES:
            rows = list(client.fetch_funding_payments(target_date, currency))
            for row in rows:
                _insert_funding_row(db, account.id, target_date, row)
                total += row.amount
    db.flush()
    return total


def _insert_funding_row(
    db: Session, account_id: int, target_date: date, row: FundingPaymentRow
) -> None:
    db.add(
        FundingRecord(
            date=target_date,
            account_id=account_id,
            currency=row.currency,
            amount=row.amount,
            external_id=row.external_id,
            raw_payload={"row": row.raw},
        )
    )


def _state_before(
    db: Session, target_date: date
) -> tuple[Decimal, Decimal, dict[int, Decimal]]:
    """期初状态：(aum_before, shares_before, {user_id: shares})。

    优先看 target_date - 1 的 daily_nav；没有就从 share_transactions 累加。
    """
    prev_date = target_date - timedelta(days=1)
    prev_nav = db.query(DailyNav).filter(DailyNav.date == prev_date).one_or_none()

    if prev_nav is not None:
        aum_before = Decimal(prev_nav.total_aum_after)
        shares_before = Decimal(prev_nav.total_shares_after)
        prev_snapshots = (
            db.query(UserShareSnapshot).filter(UserShareSnapshot.date == prev_date).all()
        )
        user_shares = {s.user_id: Decimal(s.shares) for s in prev_snapshots}
        # 补：在 prev_date 之后又有 admin_grant/revoke 的，要加到 user_shares
        cutoff = datetime.combine(target_date, datetime.min.time(), UTC)
        deltas = _share_deltas_between(db, prev_date, cutoff)
        for user_id, delta in deltas.items():
            user_shares[user_id] = user_shares.get(user_id, Decimal(0)) + delta
            shares_before += delta
        # AUM 同步：admin_grant/revoke 按 prev_nav.final_nav 估值
        for delta in deltas.values():
            aum_before += delta * Decimal(prev_nav.final_nav)
        return aum_before, shares_before, user_shares

    # 首次跑：从 share_transactions 累加，所有 grant 按初始 NAV (=1) 估值
    cutoff = datetime.combine(target_date, datetime.min.time(), UTC)
    user_shares = _all_shares_before(db, cutoff)
    shares_before = sum(user_shares.values(), Decimal(0))
    aum_before = shares_before * INITIAL_NAV
    return aum_before, shares_before, user_shares


def _all_shares_before(db: Session, cutoff: datetime) -> dict[int, Decimal]:
    rows = (
        db.query(
            ShareTransaction.user_id,
            func.coalesce(func.sum(ShareTransaction.change_amount), Decimal(0)).label("shares"),
        )
        .filter(ShareTransaction.created_at < cutoff)
        .group_by(ShareTransaction.user_id)
        .all()
    )
    return {r.user_id: Decimal(r.shares) for r in rows if Decimal(r.shares) != 0}


def _share_deltas_between(
    db: Session, after_date: date, before_dt: datetime
) -> dict[int, Decimal]:
    """[after_date 24:00 UTC, before_dt) 之间 admin_grant/revoke 净额，按用户聚合。"""
    after_dt = datetime.combine(after_date + timedelta(days=1), datetime.min.time(), UTC)
    rows = (
        db.query(
            ShareTransaction.user_id,
            func.coalesce(func.sum(ShareTransaction.change_amount), Decimal(0)).label("delta"),
        )
        .filter(
            ShareTransaction.created_at >= after_dt,
            ShareTransaction.created_at < before_dt,
            ShareTransaction.change_type.in_(
                [ShareChangeType.admin_grant.value, ShareChangeType.admin_revoke.value]
            ),
        )
        .group_by(ShareTransaction.user_id)
        .all()
    )
    return {r.user_id: Decimal(r.delta) for r in rows if Decimal(r.delta) != 0}


def _config_or_raise(db: Session, key: str, on_date: date) -> Decimal:
    value = get_current_config(db, key, on_date)
    if value is None:
        raise PipelineError(f"product_config 缺少 key={key} 在 {on_date} 生效的值")
    return Decimal(value)


def _get_treasury_user(db: Session) -> User:
    email = settings.PLATFORM_TREASURY_EMAIL
    if not email:
        raise PipelineError("PLATFORM_TREASURY_EMAIL 未配置，无法发放平台费份额")
    stmt = select(User).where(
        func.lower(User.email) == email.strip().lower(), User.role == UserRole.admin.value
    )
    user = db.scalar(stmt)
    if user is None:
        raise PipelineError(
            f"Treasury 用户 {email} 不存在或不是 admin。请先用该账号登录一次。"
        )
    return user
