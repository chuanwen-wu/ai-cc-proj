"""手动触发 pipeline 区间重算接口的鉴权 + 校验 + wiring 测试。

逐日计算的正确性由 pipeline 单测保证；这里覆盖 admin 鉴权、日期校验，
以及区间内按升序逐日调用 run_pipeline_for_date 的编排逻辑（mock 掉实际跑批）。
"""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

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


def _yesterday() -> date:
    return (datetime.now(UTC) - timedelta(days=1)).date()


def test_run_range_requires_admin() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.user.value)
    try:
        client = TestClient(app)
        d = _yesterday().isoformat()
        r = client.post("/api/v1/admin/pipeline/run-range", json={"start_date": d, "end_date": d})
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_run_range_no_token_returns_401() -> None:
    client = TestClient(app)
    d = _yesterday().isoformat()
    r = client.post("/api/v1/admin/pipeline/run-range", json={"start_date": d, "end_date": d})
    assert r.status_code == 401


def test_run_range_rejects_start_after_end() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.admin.value)
    app.dependency_overrides[get_db] = lambda: MagicMock()
    try:
        client = TestClient(app)
        r = client.post(
            "/api/v1/admin/pipeline/run-range",
            json={"start_date": "2026-05-10", "end_date": "2026-05-01"},
        )
        assert r.status_code == 400
        assert "start_date" in r.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_run_range_rejects_future_end() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.admin.value)
    app.dependency_overrides[get_db] = lambda: MagicMock()
    try:
        client = TestClient(app)
        future = (datetime.now(UTC) + timedelta(days=2)).date().isoformat()
        r = client.post(
            "/api/v1/admin/pipeline/run-range",
            json={"start_date": future, "end_date": future},
        )
        assert r.status_code == 400
        assert "未来" in r.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_run_range_rejects_span_over_limit() -> None:
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.admin.value)
    app.dependency_overrides[get_db] = lambda: MagicMock()
    try:
        client = TestClient(app)
        end = _yesterday()
        start = end - timedelta(days=400)
        r = client.post(
            "/api/v1/admin/pipeline/run-range",
            json={"start_date": start.isoformat(), "end_date": end.isoformat()},
        )
        assert r.status_code == 400
        assert "上限" in r.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_run_range_iterates_ascending_and_summarizes() -> None:
    """3 天区间：mock run_pipeline_for_date 让中间一天返回 None（跳过），其余计算。"""
    db = MagicMock()
    app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.admin.value)
    app.dependency_overrides[get_db] = lambda: db

    end = _yesterday()
    start = end - timedelta(days=2)
    called_dates: list[date] = []

    def fake_run(_db, target_date):  # noqa: ANN001
        called_dates.append(target_date)
        # 中间那天没有用户份额 → 返回 None（跳过 NAV）
        if target_date == start + timedelta(days=1):
            return None
        nav = MagicMock()
        nav.total_raw_earnings = Decimal("12.5")
        nav.platform_fee = Decimal("1.0")
        nav.gross_nav = Decimal("1.05")
        nav.final_nav = Decimal("1.0499")
        nav.admin_shares_issued = Decimal("0.9")
        return nav

    try:
        with patch("app.api.v1.admin_pipeline.run_pipeline_for_date", side_effect=fake_run):
            client = TestClient(app)
            r = client.post(
                "/api/v1/admin/pipeline/run-range",
                json={"start_date": start.isoformat(), "end_date": end.isoformat()},
            )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total_days"] == 3
        assert body["computed_days"] == 2
        assert body["skipped_days"] == 1
        assert len(body["results"]) == 3
        # 升序处理：每一日依赖前一日，顺序必须从早到晚
        assert called_dates == [start, start + timedelta(days=1), end]
        # 中间那天标记为 skipped
        assert body["results"][1]["skipped"] is True
        assert body["results"][0]["skipped"] is False
        db.commit.assert_called_once()
    finally:
        app.dependency_overrides.clear()
