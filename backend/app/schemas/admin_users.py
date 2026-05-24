from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# PM 看得见的调整类型；映射到后端 admin_grant / admin_revoke（按金额正负判断）
AdjustLabel = Literal["认购入金", "赎回出金", "修正", "其他"]


class UserListRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str | None = None
    role: str
    shares: Decimal
    valuation: Decimal  # shares * current NAV
    last_change_at: datetime | None = None


class UsersListResponse(BaseModel):
    items: list[UserListRow]
    total: int
    page: int
    page_size: int
    current_nav: Decimal


class AdjustRequest(BaseModel):
    change_amount: Decimal = Field(description="正数=入金，负数=出金")
    type: AdjustLabel
    reason: str = Field(min_length=5, max_length=500)
    # 本次调整的生效日期（UTC 自然日）。决定该笔变动在 pipeline 里何时生效（写入 created_at）。
    # 不填则用当前时间。
    effective_date: date_type | None = None


class TransactionRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    change_amount: Decimal
    change_type: str
    reason: str
    operator_email: str | None = None  # 拼出来便于前端展示
    related_date: date_type | None = None
    created_at: datetime


class TransactionsPage(BaseModel):
    items: list[TransactionRow]
    total: int
    page: int
    page_size: int
