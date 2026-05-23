"""测试 PLATFORM_TREASURY_EMAIL 启动校验。"""

import pytest

from app.core.config import settings
from app.main import _validate_startup_config


def test_no_treasury_email_is_ok(monkeypatch) -> None:
    monkeypatch.setattr(settings, "PLATFORM_TREASURY_EMAIL", None)
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "")
    _validate_startup_config()  # 应不抛错


def test_treasury_in_admin_list_is_ok(monkeypatch) -> None:
    monkeypatch.setattr(settings, "PLATFORM_TREASURY_EMAIL", "wcw8410@gmail.com")
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "wcw8410@gmail.com,other@example.com")
    _validate_startup_config()  # 应不抛错


def test_treasury_not_in_admin_list_raises(monkeypatch) -> None:
    monkeypatch.setattr(settings, "PLATFORM_TREASURY_EMAIL", "rogue@example.com")
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "wcw8410@gmail.com")
    with pytest.raises(RuntimeError, match="PLATFORM_TREASURY_EMAIL"):
        _validate_startup_config()


def test_treasury_case_insensitive_match(monkeypatch) -> None:
    monkeypatch.setattr(settings, "PLATFORM_TREASURY_EMAIL", "WCW8410@Gmail.com")
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "wcw8410@gmail.com")
    _validate_startup_config()  # 应不抛错
