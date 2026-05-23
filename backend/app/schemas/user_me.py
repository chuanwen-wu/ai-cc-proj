"""用户个人看板接口的数据模型（/api/v1/me/*）。"""

from datetime import date as date_type
from decimal import Decimal

from pydantic import BaseModel


class MeSummary(BaseModel):
    shares: Decimal
    current_nav: Decimal
    valuation: Decimal  # shares * current_nav
    cost_basis: Decimal  # 累计净入金（按每笔 txn 当时 NAV 折算）
    cumulative_return: Decimal  # valuation - cost_basis
    cumulative_return_pct: Decimal | None = None  # 累计收益率 %
    today_change: Decimal | None = None  # 今日估值变化
    today_change_pct: Decimal | None = None  # 今日变化 %
    has_history: bool  # 用于前端判断空状态


class MeSeriesPoint(BaseModel):
    date: date_type
    shares: Decimal
    nav: Decimal  # 当日 final_nav
    valuation: Decimal  # shares * nav
    cumulative_return_pct: Decimal | None = None  # 截至当日的累计收益率 %


class MeHistoryRow(BaseModel):
    date: date_type
    shares: Decimal
    nav: Decimal
    valuation: Decimal
    day_change: Decimal | None = None  # 较前一日估值变化 USD
    day_change_pct: Decimal | None = None  # 较前一日估值变化 %


class MeHistoryPage(BaseModel):
    items: list[MeHistoryRow]
    total: int
    page: int
    page_size: int
