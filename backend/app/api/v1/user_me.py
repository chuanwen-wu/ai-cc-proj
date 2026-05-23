"""用户个人看板接口（任何登录用户可访问）。"""

from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.daily_nav import DailyNav
from app.models.share_transaction import ShareTransaction
from app.models.user import User
from app.models.user_share_snapshot import UserShareSnapshot
from app.schemas.user_me import (
    MeHistoryPage,
    MeHistoryRow,
    MeSeriesPoint,
    MeSummary,
)

router = APIRouter(prefix="/me", tags=["me"])

DEFAULT_NAV = Decimal("1.0")


def _latest_nav(db: Session) -> Decimal:
    row = db.query(DailyNav.final_nav).order_by(DailyNav.date.desc()).first()
    return Decimal(row[0]) if row else DEFAULT_NAV


def _user_shares(db: Session, user_id: int) -> Decimal:
    total = db.scalar(
        select(
            func.coalesce(func.sum(ShareTransaction.change_amount), Decimal(0))
        ).where(ShareTransaction.user_id == user_id)
    )
    return Decimal(total or 0)


def _cost_basis(db: Session, user_id: int) -> Decimal:
    """Walk each share transaction and multiply delta × NAV at txn time.

    "NAV at txn time" = latest daily_nav.final_nav where date <= txn.created_at.date().
    Falls back to DEFAULT_NAV (1.0) when no daily_nav exists yet.
    """
    txns = (
        db.query(ShareTransaction.change_amount, ShareTransaction.created_at)
        .filter(ShareTransaction.user_id == user_id)
        .order_by(ShareTransaction.created_at.asc())
        .all()
    )
    if not txns:
        return Decimal(0)

    # 一次拿到所有 txn 日期需要的 NAV（按 date asc）
    dates = sorted({t.created_at.date() for t in txns})
    nav_rows = (
        db.query(DailyNav.date, DailyNav.final_nav)
        .filter(DailyNav.date <= dates[-1])
        .order_by(DailyNav.date.asc())
        .all()
    )
    # 构造 {date: final_nav} 并补成 "截至该日的最新 NAV" 查询
    nav_by_date = {r.date: Decimal(r.final_nav) for r in nav_rows}
    # 按日期累加以便取 "<= d 的最新"
    running_nav = DEFAULT_NAV
    cumulative_nav: dict = {}
    for d in sorted(nav_by_date.keys()):
        running_nav = nav_by_date[d]
        cumulative_nav[d] = running_nav

    total = Decimal(0)
    for txn in txns:
        d = txn.created_at.date()
        # 找 <= d 的最新 NAV
        nav_at = DEFAULT_NAV
        best = None
        for nav_d in cumulative_nav:
            if nav_d <= d:
                best = nav_d
            else:
                break
        if best is not None:
            nav_at = cumulative_nav[best]
        total += Decimal(txn.change_amount) * nav_at
    return total


def _today_change(db: Session, user_id: int) -> tuple[Decimal | None, Decimal | None]:
    """Return (today_change, today_change_pct) by comparing latest 2 snapshots."""
    snaps = (
        db.query(UserShareSnapshot)
        .filter(UserShareSnapshot.user_id == user_id)
        .order_by(UserShareSnapshot.date.desc())
        .limit(2)
        .all()
    )
    if len(snaps) < 2:
        return None, None
    today_val = Decimal(snaps[0].share_value)
    yesterday_val = Decimal(snaps[1].share_value)
    change = today_val - yesterday_val
    pct = (change / yesterday_val * Decimal(100)) if yesterday_val != 0 else None
    return change, pct


@router.get("/summary", response_model=MeSummary)
def me_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MeSummary:
    shares = _user_shares(db, current_user.id)
    nav = _latest_nav(db)
    valuation = shares * nav
    cost_basis = _cost_basis(db, current_user.id)
    cumulative_return = valuation - cost_basis
    cumulative_return_pct = (
        (cumulative_return / cost_basis * Decimal(100)) if cost_basis != 0 else None
    )
    today_change, today_change_pct = _today_change(db, current_user.id)
    has_history = (
        db.query(
            select(UserShareSnapshot)
            .where(UserShareSnapshot.user_id == current_user.id)
            .exists()
        ).scalar()
        or False
    )

    return MeSummary(
        shares=shares,
        current_nav=nav,
        valuation=valuation,
        cost_basis=cost_basis,
        cumulative_return=cumulative_return,
        cumulative_return_pct=cumulative_return_pct,
        today_change=today_change,
        today_change_pct=today_change_pct,
        has_history=bool(has_history),
    )


def _build_series(
    db: Session, user_id: int, limit: int
) -> list[MeSeriesPoint]:
    """Return up to `limit` points in ascending date order."""
    rows = (
        db.query(UserShareSnapshot, DailyNav.final_nav)
        .join(DailyNav, DailyNav.date == UserShareSnapshot.date)
        .filter(UserShareSnapshot.user_id == user_id)
        .order_by(UserShareSnapshot.date.desc())
        .limit(limit)
        .all()
    )
    if not rows:
        return []

    rows = list(reversed(rows))  # asc

    # 预取所有相关日期用于 cost_basis 计算（按日期）
    dates = [s.date for s, _ in rows]
    # 对每个日期，计算截至该日的累计 cost_basis 和 shares
    txns = (
        db.query(
            ShareTransaction.created_at, ShareTransaction.change_amount
        )
        .filter(ShareTransaction.user_id == user_id)
        .order_by(ShareTransaction.created_at.asc())
        .all()
    )
    # 同时预取所有 NAV
    nav_rows = (
        db.query(DailyNav.date, DailyNav.final_nav)
        .filter(DailyNav.date <= dates[-1])
        .order_by(DailyNav.date.asc())
        .all()
    )
    nav_by_date = {r.date: Decimal(r.final_nav) for r in nav_rows}

    points: list[MeSeriesPoint] = []
    running_shares = Decimal(0)
    running_cost = Decimal(0)
    txn_idx = 0
    for snap, final_nav_raw in rows:
        d = snap.date
        # 应用所有 txn.created_at.date() <= d 的交易
        while txn_idx < len(txns) and txns[txn_idx].created_at.date() <= d:
            delta = Decimal(txns[txn_idx].change_amount)
            txn_date = txns[txn_idx].created_at.date()
            # NAV at txn time
            nav_at = DEFAULT_NAV
            for nd in sorted(nav_by_date.keys()):
                if nd <= txn_date:
                    nav_at = nav_by_date[nd]
                else:
                    break
            running_cost += delta * nav_at
            running_shares += delta
            txn_idx += 1

        shares_at_d = Decimal(snap.shares)
        nav_at_d = Decimal(final_nav_raw)
        valuation = Decimal(snap.share_value)
        cum_pct = (
            ((valuation - running_cost) / running_cost * Decimal(100))
            if running_cost != 0
            else None
        )
        points.append(
            MeSeriesPoint(
                date=d,
                shares=shares_at_d,
                nav=nav_at_d,
                valuation=valuation,
                cumulative_return_pct=cum_pct,
            )
        )
    return points


@router.get("/series", response_model=list[MeSeriesPoint])
def me_series(
    days: int = Query(default=30, ge=1, le=3650),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MeSeriesPoint]:
    return _build_series(db, current_user.id, days)


@router.get("/history", response_model=MeHistoryPage)
def me_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MeHistoryPage:
    total = (
        db.query(func.count())
        .select_from(UserShareSnapshot)
        .filter(UserShareSnapshot.user_id == current_user.id)
        .scalar()
    ) or 0

    rows = (
        db.query(UserShareSnapshot, DailyNav.final_nav)
        .join(DailyNav, DailyNav.date == UserShareSnapshot.date)
        .filter(UserShareSnapshot.user_id == current_user.id)
        .order_by(UserShareSnapshot.date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # 为计算 day_change，需要每行的"前一天"估值。一次多拉一条用于首行的 prev。
    items: list[MeHistoryRow] = []
    for snap, final_nav_raw in rows:
        # prev: 同一用户 < snap.date 的最新快照
        prev_snap = (
            db.query(UserShareSnapshot)
            .filter(
                and_(
                    UserShareSnapshot.user_id == current_user.id,
                    UserShareSnapshot.date < snap.date,
                )
            )
            .order_by(UserShareSnapshot.date.desc())
            .first()
        )
        valuation = Decimal(snap.share_value)
        if prev_snap:
            prev_val = Decimal(prev_snap.share_value)
            day_change = valuation - prev_val
            day_change_pct = (
                (day_change / prev_val * Decimal(100)) if prev_val != 0 else None
            )
        else:
            day_change = None
            day_change_pct = None

        items.append(
            MeHistoryRow(
                date=snap.date,
                shares=Decimal(snap.shares),
                nav=Decimal(final_nav_raw),
                valuation=valuation,
                day_change=day_change,
                day_change_pct=day_change_pct,
            )
        )

    return MeHistoryPage(items=items, total=total, page=page, page_size=page_size)
