from app.api.v1.auth import _expected_role
from app.core.config import settings


def test_role_admin_when_email_in_admin_list(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "foo@bar.com,wcw8410@gmail.com")
    assert _expected_role("wcw8410@gmail.com") == "admin"


def test_role_user_when_email_not_in_admin_list(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "foo@bar.com")
    assert _expected_role("random@gmail.com") == "user"


def test_role_assignment_is_case_insensitive(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "Wcw8410@Gmail.com")
    assert _expected_role("wcw8410@gmail.com") == "admin"
    assert _expected_role("WCW8410@GMAIL.COM") == "admin"
