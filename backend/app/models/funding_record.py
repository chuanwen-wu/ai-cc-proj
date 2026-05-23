from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FundingRecord(Base):
    __tablename__ = "funding_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date_type] = mapped_column(Date, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("bitfinex_accounts.id"), index=True)
    currency: Mapped[str] = mapped_column(String(10))  # USD / UST
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
