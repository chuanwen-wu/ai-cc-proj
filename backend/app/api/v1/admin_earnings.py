"""管理员产品收益看板接口（admin-only）。"""

from datetime import date as date_type
from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.bitfinex_account import BitfinexAccount
from app.models.daily_nav import DailyNav
from app.models.funding_record import FundingRecord
from app.models.user import User
from app.schemas.admin_earnings import (
    AccountBreakdownRow,
    EarningsHistoryPage,
    EarningsSeriesPoint,
    EarningsSummary,
)

router = APIRouter(prefix="/admin/earnings", tags=["admin"])


def _to_point(row: DailyNav) -> EarningsSeriesPoint:
    return EarningsSeriesPoint(
        date=row.date,
        nav=Decimal(row.final_nav),
        raw=Decimal(row.total_raw_earnings),
        fee=Decimal(row.platform_fee),
        net=Decimal(row.total_raw_earnings) - Decimal(row.platform_fee),
        gross_nav=Decimal(row.gross_nav),
        final_nav=Decimal(row.final_nav),
        aum_start=Decimal(row.total_aum_before),
        aum_end=Decimal(row.total_aum_after),
    )


def _pct_change(latest: Decimal, base: Decimal) -> Decimal | None:
    if base == 0:
        return None
    return ((latest - base) / base) * Decimal(100)


@router.get("/summary", response_model=EarningsSummary)
def earnings_summary(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> EarningsSummary:
    latest = db.query(DailyNav).order_by(DailyNav.date.desc()).first()
    if latest is None:
        return EarningsSummary()

    prev = (
        db.query(DailyNav)
        .filter(DailyNav.date < latest.date)
        .order_by(DailyNav.date.desc())
        .first()
    )
    cum_fee = (
        db.query(func.coalesce(func.sum(DailyNav.platform_fee), Decimal(0))).scalar()
        or Decimal(0)
    )
    thirty_back = (
        db.query(DailyNav)
        .filter(DailyNav.date <= latest.date - timedelta(days=30))
        .order_by(DailyNav.date.desc())
        .first()
    )

    return EarningsSummary(
        current_nav=Decimal(latest.final_nav),
        current_nav_change_pct=(
            _pct_change(Decimal(latest.final_nav), Decimal(prev.final_nav)) if prev else None
        ),
        today_raw_earnings=Decimal(latest.total_raw_earnings),
        today_raw_change_pct=(
            _pct_change(
                Decimal(latest.total_raw_earnings), Decimal(prev.total_raw_earnings)
            )
            if prev
            else None
        ),
        cumulative_platform_fee=Decimal(cum_fee),
        total_aum=Decimal(latest.total_aum_after),
        total_aum_change_pct=(
            _pct_change(Decimal(latest.total_aum_after), Decimal(thirty_back.total_aum_after))
            if thirty_back
            else None
        ),
        latest_date=latest.date,
    )


@router.get("/series", response_model=list[EarningsSeriesPoint])
def earnings_series(
    days: int = Query(default=30, ge=1, le=3650),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> list[EarningsSeriesPoint]:
    rows = (
        db.query(DailyNav).order_by(DailyNav.date.desc()).limit(days).all()
    )
    return [_to_point(r) for r in reversed(rows)]  # ascending for chart


@router.get("/history", response_model=EarningsHistoryPage)
def earnings_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> EarningsHistoryPage:
    total = db.query(func.count(DailyNav.id)).scalar() or 0
    rows = (
        db.query(DailyNav)
        .order_by(DailyNav.date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return EarningsHistoryPage(
        items=[_to_point(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/history/{target}/breakdown", response_model=list[AccountBreakdownRow])
def earnings_breakdown(
    target: date_type,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> list[AccountBreakdownRow]:
    # 校验该日 daily_nav 存在
    nav = db.query(DailyNav).filter(DailyNav.date == target).one_or_none()
    if nav is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"No daily_nav for {target}"
        )
    rows = (
        db.query(
            FundingRecord.account_id,
            BitfinexAccount.label,
            FundingRecord.currency,
            func.sum(FundingRecord.amount).label("amount"),
        )
        .join(BitfinexAccount, BitfinexAccount.id == FundingRecord.account_id)
        .filter(FundingRecord.date == target)
        .group_by(FundingRecord.account_id, BitfinexAccount.label, FundingRecord.currency)
        .order_by(BitfinexAccount.label, FundingRecord.currency)
        .all()
    )
    return [
        AccountBreakdownRow(
            account_id=r.account_id,
            account_label=r.label,
            currency=r.currency,
            amount=Decimal(r.amount),
        )
        for r in rows
    ]
