import enum
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ShareChangeType(enum.StrEnum):
    admin_grant = "admin_grant"
    admin_revoke = "admin_revoke"
    fee_issuance = "fee_issuance"
    initial = "initial"


class ShareTransaction(Base):
    """份额变动流水。append-only：代码里只 insert，不 update / delete。"""

    __tablename__ = "share_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    change_amount: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    change_type: Mapped[str] = mapped_column(String(50))
    reason: Mapped[str] = mapped_column(Text)
    operator_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )  # NULL 表示系统自动
    related_date: Mapped[date_type | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
