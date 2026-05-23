from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.db.base import Base


class ProductConfig(Base):
    """产品参数表，按 (key, effective_from, effective_to) 存历史值。"""

    __tablename__ = "product_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[Decimal] = mapped_column(Numeric(20, 10))
    effective_from: Mapped[date_type] = mapped_column(Date)
    effective_to: Mapped[date_type | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


def get_current_config(db: Session, key: str, on_date: date_type) -> Decimal | None:
    """查询给定 key 在 on_date 当天生效的 value。"""
    stmt = (
        select(ProductConfig.value)
        .where(
            ProductConfig.key == key,
            ProductConfig.effective_from <= on_date,
            (ProductConfig.effective_to.is_(None)) | (ProductConfig.effective_to >= on_date),
        )
        .order_by(ProductConfig.effective_from.desc())
        .limit(1)
    )
    return db.scalar(stmt)
