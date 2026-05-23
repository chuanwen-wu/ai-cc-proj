from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DailyNav(Base):
    __tablename__ = "daily_nav"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date_type] = mapped_column(Date, unique=True, index=True)
    total_raw_earnings: Mapped[Decimal] = mapped_column(Numeric(20, 8), server_default="0")
    platform_fee: Mapped[Decimal] = mapped_column(Numeric(20, 8), server_default="0")
    gross_nav: Mapped[Decimal] = mapped_column(Numeric(20, 10))
    final_nav: Mapped[Decimal] = mapped_column(Numeric(20, 10))
    total_aum_before: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    total_aum_after: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    total_shares_before: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    total_shares_after: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    admin_shares_issued: Mapped[Decimal] = mapped_column(Numeric(20, 8), server_default="0")
    fee_threshold_apy_used: Mapped[Decimal] = mapped_column(Numeric(20, 10))
    fee_rate_used: Mapped[Decimal] = mapped_column(Numeric(20, 10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
