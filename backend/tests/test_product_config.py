"""测试 get_current_config：用 mock Session 而非真实 DB。"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

from app.models.product_config import get_current_config


def test_get_current_config_returns_value() -> None:
    db = MagicMock()
    db.scalar.return_value = Decimal("0.04")
    result = get_current_config(db, "fee_threshold_apy", date(2026, 5, 23))
    assert result == Decimal("0.04")
    db.scalar.assert_called_once()


def test_get_current_config_returns_none_if_missing() -> None:
    db = MagicMock()
    db.scalar.return_value = None
    result = get_current_config(db, "nonexistent_key", date(2026, 5, 23))
    assert result is None
