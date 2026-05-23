"""管理员收益接口的鉴权 + 基本响应形态测试。

业务数据的正确性由 pipeline 单测 + 端到端本地验证保证；这里只确保 admin
鉴权 + 路由 wiring 正确。
"""

from decimal import Decimal
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.db.session import get_db
from app.main import app
from app.models.user import User, UserRole


def _make_user(role: str) -> User:
    return User(
        id=1,
        google_sub="sub-1",
        email="test@example.com",
        name="Test",
        avatar_url=None,
        role=role,
    )


def _stub_empty_db() -> MagicMock:
    db = MagicMock()
    db.query.return_value.order_by.return_value.first.return_value = None
    db.query.return_value.order_by.return_value.limit.return_value.all.return_value = []
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    db.query.return_value.filter.return_value.one_or_none.return_value = None
    db.query.return_value.scalar.return_value = Decimal(0)
    db.query.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
    return db


def test_summary_requires_admin() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.user.value)
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/earnings/summary")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_summary_admin_empty() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.admin.value)
    app.dependency_overrides[get_db] = _stub_empty_db
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/earnings/summary")
        assert r.status_code == 200
        body = r.json()
        assert body["current_nav"] is None
        assert body["cumulative_platform_fee"] == "0"
    finally:
        app.dependency_overrides.clear()


def test_series_admin_empty() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.admin.value)
    app.dependency_overrides[get_db] = _stub_empty_db
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/earnings/series?days=30")
        assert r.status_code == 200
        assert r.json() == []
    finally:
        app.dependency_overrides.clear()


def test_history_admin_empty() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.admin.value)
    app.dependency_overrides[get_db] = _stub_empty_db
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/earnings/history?page=1&page_size=20")
        assert r.status_code == 200
        body = r.json()
        assert body["items"] == []
        assert body["total"] == 0
        assert body["page"] == 1
    finally:
        app.dependency_overrides.clear()


def test_breakdown_404_when_no_nav() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.admin.value)
    app.dependency_overrides[get_db] = _stub_empty_db
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/earnings/history/2026-05-23/breakdown")
        assert r.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_summary_no_token_returns_401() -> None:
    client = TestClient(app)
    r = client.get("/api/v1/admin/earnings/summary")
    assert r.status_code == 401
