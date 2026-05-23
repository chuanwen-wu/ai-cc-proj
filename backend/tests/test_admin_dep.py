"""测试 get_current_admin 依赖：admin 通过，普通用户 403。"""

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
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


def test_admin_ping_returns_200_for_admin() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.admin.value)
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/ping")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
    finally:
        app.dependency_overrides.clear()


def test_admin_ping_returns_403_for_regular_user() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.user.value)
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/ping")
        assert r.status_code == 403
        assert r.json()["detail"] == "Admin only"
    finally:
        app.dependency_overrides.clear()


def test_admin_ping_returns_401_without_auth() -> None:
    client = TestClient(app)
    r = client.get("/api/v1/admin/ping")
    assert r.status_code == 401
