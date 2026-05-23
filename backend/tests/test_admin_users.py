"""管理员用户管理接口的鉴权 + 输入校验 + 基本业务规则测试。

业务数据端到端的正确性由本地 Playwright 验证保证；这里只确保：
* 鉴权（401 / 403）
* Pydantic 入参校验（reason 长度、change_amount 非零）
* 份额变负时拒绝
* 响应结构正确（空 DB、成功调整）
"""

from datetime import UTC, datetime
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

def _make_user(role: str, *, uid: int = 1, email: str = "admin@example.com") -> User:
    return User(
        id=uid,
        google_sub=f"sub-{uid}",
        email=email,
        name="Test",
        avatar_url=None,
        role=role,
    )


def _admin() -> User:
    return _make_user(UserRole.admin.value, uid=100, email="admin@example.com")


def _target_user() -> User:
    return _make_user(UserRole.user.value, uid=7, email="user@example.com")


def _new_db_stub() -> MagicMock:
    """Return a fresh MagicMock session suitable for list_users (empty result)."""
    db = MagicMock()
    # _current_nav → None → default 1.0
    db.query.return_value.order_by.return_value.first.return_value = None
    # list_users: count subquery → 0
    db.scalar.return_value = 0
    # list_users: main rows → []
    db.execute.return_value.all.return_value = []
    return db


def _db_for_adjust(
    *,
    current_shares: Decimal = Decimal("100"),
    nav_first: tuple | None = None,
    max_created_at: datetime | None = None,
) -> MagicMock:
    """Stub DB for adjust_shares happy path.

    Order of db.scalar() calls in adjust_shares:
      1. _user_shares → sum(change_amount) → current_shares
      2. (after commit) func.max(created_at) → max_created_at
    """
    db = MagicMock()
    # db.get(User, user_id) → target user
    db.get.return_value = _target_user()

    # db.scalar is called twice, in order: current shares, then max(created_at)
    db.scalar.side_effect = [current_shares, max_created_at]

    # db.add / db.commit are no-ops
    db.add.return_value = None
    db.commit.return_value = None

    # _current_nav uses db.query(DailyNav.final_nav).order_by(...).first()
    db.query.return_value.order_by.return_value.first.return_value = nav_first
    return db


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def test_list_no_token_returns_401() -> None:
    client = TestClient(app)
    r = client.get("/api/v1/admin/users")
    assert r.status_code == 401


def test_list_non_admin_returns_403() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.user.value)
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/users")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_adjust_no_token_returns_401() -> None:
    client = TestClient(app)
    r = client.post(
        "/api/v1/admin/users/7/shares",
        json={"change_amount": "10", "type": "认购入金", "reason": "test reason"},
    )
    assert r.status_code == 401


def test_adjust_non_admin_returns_403() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.user.value)
    try:
        client = TestClient(app)
        r = client.post(
            "/api/v1/admin/users/7/shares",
            json={"change_amount": "10", "type": "认购入金", "reason": "test reason"},
        )
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# list_users
# ---------------------------------------------------------------------------

def test_list_admin_empty_db() -> None:
    app.dependency_overrides[get_current_user] = _admin
    app.dependency_overrides[get_db] = _new_db_stub
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/users")
        assert r.status_code == 200
        body = r.json()
        assert body["items"] == []
        assert body["total"] == 0
        assert body["page"] == 1
        # _current_nav returns None → default 1.0
        assert Decimal(body["current_nav"]) == Decimal("1.0")
    finally:
        app.dependency_overrides.clear()


def test_list_search_returns_matching_user() -> None:
    """Search hits a single row with 50 shares, nav = 2.0 → valuation = 100."""
    db = MagicMock()
    db.query.return_value.order_by.return_value.first.return_value = ("2.0000000000",)
    # total count
    db.scalar.return_value = 1
    # main query returns one row: (User, shares, last_change_at)
    ts = datetime(2026, 5, 20, 12, 0, 0, tzinfo=UTC)
    db.execute.return_value.all.return_value = [(_target_user(), Decimal("50"), ts)]

    app.dependency_overrides[get_current_user] = _admin
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/users?search=user")
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 1
        row = body["items"][0]
        assert row["id"] == 7
        assert row["email"] == "user@example.com"
        assert Decimal(row["shares"]) == Decimal("50")
        assert Decimal(row["valuation"]) == Decimal("100.0")
        assert Decimal(body["current_nav"]) == Decimal("2.0")
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# adjust_shares - input validation
# ---------------------------------------------------------------------------

def test_adjust_reason_too_short() -> None:
    app.dependency_overrides[get_current_user] = _admin
    app.dependency_overrides[get_db] = _new_db_stub
    try:
        client = TestClient(app)
        r = client.post(
            "/api/v1/admin/users/7/shares",
            json={"change_amount": "10", "type": "认购入金", "reason": "abc"},  # < 5 chars
        )
        assert r.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_adjust_zero_amount_rejected() -> None:
    """delta = 0 must 400 before any DB write."""
    db = MagicMock()
    db.get.return_value = _target_user()
    # db.scalar should NOT be called when delta == 0 (short-circuit in handler)
    app.dependency_overrides[get_current_user] = _admin
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        r = client.post(
            "/api/v1/admin/users/7/shares",
            json={"change_amount": "0", "type": "修正", "reason": "zero adjust"},
        )
        assert r.status_code == 400
        assert "non-zero" in r.json()["detail"]
        db.add.assert_not_called()
        db.commit.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_adjust_unknown_user_returns_404() -> None:
    db = MagicMock()
    db.get.return_value = None  # user not found
    app.dependency_overrides[get_current_user] = _admin
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        r = client.post(
            "/api/v1/admin/users/999/shares",
            json={"change_amount": "10", "type": "认购入金", "reason": "valid reason"},
        )
        assert r.status_code == 404
        db.add.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_adjust_would_make_negative_shares_rejected() -> None:
    """User has 10 shares; revoking 20 must be rejected."""
    db = _db_for_adjust(current_shares=Decimal("10"))
    app.dependency_overrides[get_current_user] = _admin
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        r = client.post(
            "/api/v1/admin/users/7/shares",
            json={"change_amount": "-20", "type": "赎回出金", "reason": "big withdrawal"},
        )
        assert r.status_code == 400
        assert "负" in r.json()["detail"]
        db.add.assert_not_called()
        db.commit.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_adjust_revoke_all_allowed() -> None:
    """User has 10 shares; revoking exactly 10 → 0 shares must succeed."""
    ts = datetime(2026, 5, 23, 10, 0, 0, tzinfo=UTC)
    db = _db_for_adjust(current_shares=Decimal("10"), max_created_at=ts)
    app.dependency_overrides[get_current_user] = _admin
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        r = client.post(
            "/api/v1/admin/users/7/shares",
            json={"change_amount": "-10", "type": "赎回出金", "reason": "full redemption"},
        )
        assert r.status_code == 201
        body = r.json()
        assert Decimal(body["shares"]) == Decimal("0")
        assert Decimal(body["valuation"]) == Decimal("0")
        db.add.assert_called_once()
        db.commit.assert_called_once()
    finally:
        app.dependency_overrides.clear()


def test_adjust_grant_success() -> None:
    """User has 100 shares; grant +50 → 150 shares; nav=2 → valuation=300."""
    ts = datetime(2026, 5, 23, 10, 0, 0, tzinfo=UTC)
    db = _db_for_adjust(
        current_shares=Decimal("100"),
        nav_first=("2.0000000000",),
        max_created_at=ts,
    )
    app.dependency_overrides[get_current_user] = _admin
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        r = client.post(
            "/api/v1/admin/users/7/shares",
            json={"change_amount": "50", "type": "认购入金", "reason": "new subscription"},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 7
        assert Decimal(body["shares"]) == Decimal("150")
        assert Decimal(body["valuation"]) == Decimal("300.0")
        # reason 在落库时被加上 [type] 前缀
        saved_tx = db.add.call_args.args[0]
        assert saved_tx.reason == "[认购入金] new subscription"
        assert saved_tx.change_type == "admin_grant"
        assert saved_tx.operator_id == 100  # admin id
    finally:
        app.dependency_overrides.clear()


def test_adjust_revoke_uses_admin_revoke_type() -> None:
    """Negative delta maps to admin_revoke change_type."""
    ts = datetime(2026, 5, 23, 10, 0, 0, tzinfo=UTC)
    db = _db_for_adjust(current_shares=Decimal("100"), max_created_at=ts)
    app.dependency_overrides[get_current_user] = _admin
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        r = client.post(
            "/api/v1/admin/users/7/shares",
            json={"change_amount": "-30", "type": "赎回出金", "reason": "partial redemption"},
        )
        assert r.status_code == 201
        saved_tx = db.add.call_args.args[0]
        assert saved_tx.change_type == "admin_revoke"
        assert saved_tx.reason == "[赎回出金] partial redemption"
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# list_transactions
# ---------------------------------------------------------------------------

def test_transactions_unknown_user_returns_404() -> None:
    db = MagicMock()
    db.get.return_value = None
    app.dependency_overrides[get_current_user] = _admin
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        r = client.get("/api/v1/admin/users/999/transactions")
        assert r.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_transactions_no_token_returns_401() -> None:
    client = TestClient(app)
    r = client.get("/api/v1/admin/users/7/transactions")
    assert r.status_code == 401
