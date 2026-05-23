from datetime import date as date_type
from decimal import Decimal

from pydantic import BaseModel


class EarningsSummary(BaseModel):
    current_nav: Decimal | None = None
    current_nav_change_pct: Decimal | None = None  # vs 昨日 final_nav
    today_raw_earnings: Decimal | None = None
    today_raw_change_pct: Decimal | None = None  # vs 昨日 raw
    cumulative_platform_fee: Decimal = Decimal(0)
    total_aum: Decimal | None = None
    total_aum_change_pct: Decimal | None = None  # vs 30 日前
    latest_date: date_type | None = None


class EarningsSeriesPoint(BaseModel):
    date: date_type
    nav: Decimal  # = final_nav，方便前端
    raw: Decimal
    fee: Decimal
    net: Decimal  # raw - fee
    gross_nav: Decimal
    final_nav: Decimal
    aum_start: Decimal
    aum_end: Decimal


class EarningsHistoryPage(BaseModel):
    items: list[EarningsSeriesPoint]
    total: int
    page: int
    page_size: int


class AccountBreakdownRow(BaseModel):
    account_id: int
    account_label: str
    currency: str
    amount: Decimal
