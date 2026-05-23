"""用户个人看板 /me/* 接口的鉴权 + 业务规则测试。"""

from datetime import date as date_type
from decimal import Decimal
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.db.session import get_db
from app.main import app
from app.models.user import User, UserRole

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(role: str = UserRole.user.value, *, uid: int = 7) -> User:
    return User(
        id=uid,
        google_sub=f"sub-{uid}",
        email="user@example.com",
        name="Test User",
        avatar_url=None,
        role=role,
    )


def _empty_db() -> MagicMock:
    """DB returning empty results for all /me/* queries."""
    db = MagicMock()
    # _latest_nav: no daily_nav → default 1.0
    db.query.return_value.order_by.return_value.first.return_value = None
    # _user_shares: coalesce → 0
    db.scalar.return_value = Decimal(0)
    # _cost_basis: no txns
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
    # _today_change: no snapshots
    db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
    # has_history exists(): scalar returns False
    # me_history: total=0
    # me_series: no rows
    return db


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_summary_no_token_returns_401() -> None:
    client = TestClient(app)
    r = client.get("/api/v1/me/summary")
    assert r.status_code == 401


def test_series_no_token_returns_401() -> None:
    client = TestClient(app)
    r = client.get("/api/v1/me/series")
    assert r.status_code == 401


def test_history_no_token_returns_401() -> None:
    client = TestClient(app)
    r = client.get("/api/v1/me/history")
    assert r.status_code == 401


def test_me_is_open_to_regular_users() -> None:
    """Unlike admin endpoints, /me/* does NOT require admin role."""
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.user.value)
    app.dependency_overrides[get_db] = _empty_db
    try:
        client = TestClient(app)
        r = client.get("/api/v1/me/summary")
        # may be 200 or 500 depending on mock completeness, but NOT 403
        assert r.status_code != 403
    finally:
        app.dependency_overrides.clear()


def test_me_also_accessible_by_admins() -> None:
    """Admins can also see their own dashboard (they may hold shares too)."""
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.admin.value)
    app.dependency_overrides[get_db] = _empty_db
    try:
        client = TestClient(app)
        r = client.get("/api/v1/me/summary")
        assert r.status_code != 403
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------


def test_series_rejects_invalid_days() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user()
    try:
        client = TestClient(app)
        r = client.get("/api/v1/me/series?days=0")
        assert r.status_code == 422
        r = client.get("/api/v1/me/series?days=99999")
        assert r.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_history_rejects_invalid_page() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user()
    try:
        client = TestClient(app)
        r = client.get("/api/v1/me/history?page=0")
        assert r.status_code == 422
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Schema imports (smoke test)
# ---------------------------------------------------------------------------


def test_schemas_importable() -> None:
    from app.schemas.user_me import (
        MeHistoryPage,
        MeHistoryRow,
        MeSeriesPoint,
        MeSummary,
    )

    # Construct minimal instances to ensure field types are correct
    s = MeSummary(
        shares=Decimal("0"),
        current_nav=Decimal("1"),
        valuation=Decimal("0"),
        cost_basis=Decimal("0"),
        cumulative_return=Decimal("0"),
        cumulative_return_pct=None,
        today_change=None,
        today_change_pct=None,
        has_history=False,
    )
    assert s.has_history is False

    p = MeSeriesPoint(
        date=date_type(2026, 5, 23),
        shares=Decimal("100"),
        nav=Decimal("1.5"),
        valuation=Decimal("150"),
        cumulative_return_pct=None,
    )
    assert p.date == date_type(2026, 5, 23)

    row = MeHistoryRow(
        date=date_type(2026, 5, 23),
        shares=Decimal("100"),
        nav=Decimal("1.5"),
        valuation=Decimal("150"),
        day_change=None,
        day_change_pct=None,
    )
    assert row.valuation == Decimal("150")

    page = MeHistoryPage(items=[row], total=1, page=1, page_size=20)
    assert page.total == 1
