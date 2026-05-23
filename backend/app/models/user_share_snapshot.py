from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserShareSnapshot(Base):
    __tablename__ = "user_share_snapshots"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    date: Mapped[date_type] = mapped_column(Date, primary_key=True)
    shares: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    share_value: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
