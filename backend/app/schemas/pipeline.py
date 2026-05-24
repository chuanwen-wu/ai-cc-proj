from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PipelineRunResponse(BaseModel):
    date: date
    skipped: bool
    raw_earnings: Decimal | None = None
    platform_fee: Decimal | None = None
    gross_nav: Decimal | None = None
    final_nav: Decimal | None = None
    admin_shares_issued: Decimal | None = None
    message: str


class PipelineRangeRequest(BaseModel):
    start_date: date
    end_date: date


class PipelineRangeRunResponse(BaseModel):
    start_date: date
    end_date: date
    total_days: int
    computed_days: int
    skipped_days: int
    results: list[PipelineRunResponse]


class DailyNavOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    total_raw_earnings: Decimal
    platform_fee: Decimal
    gross_nav: Decimal
    final_nav: Decimal
    total_aum_before: Decimal
    total_aum_after: Decimal
    total_shares_before: Decimal
    total_shares_after: Decimal
    admin_shares_issued: Decimal
    created_at: datetime
