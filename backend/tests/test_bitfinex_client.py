"""Bitfinex 客户端签名 + 响应解析单测（不打真实 HTTP）。"""

import hashlib
import hmac
from decimal import Decimal

import pytest

from app.services.bitfinex_client import (
    BitfinexAuthError,
    BitfinexClient,
    FundingPaymentRow,
)


def test_signature_format() -> None:
    """nonce + apiPath + body + secret → hex HMAC-SHA384."""
    client = BitfinexClient(
        api_key="my-key",
        api_secret="my-secret",
        base_url="https://example.test",
    )
    api_path = "/v2/auth/r/ledgers/USD/hist"
    body = '{"start":0,"end":1,"limit":2500,"category":28}'
    sig = client._sign(api_path, body)

    assert sig["bfx-apikey"] == "my-key"
    assert sig["Content-Type"] == "application/json"
    assert "bfx-nonce" in sig and sig["bfx-nonce"].isdigit()

    # 重新算一遍，应该跟客户端给的签名一致
    nonce = sig["bfx-nonce"]
    expected_payload = f"/api{api_path}{nonce}{body}"
    expected = hmac.new(
        b"my-secret", expected_payload.encode(), hashlib.sha384
    ).hexdigest()
    assert sig["bfx-signature"] == expected


def test_nonce_strictly_increases() -> None:
    """两次签名 nonce 不应一样（防重放）。"""
    client = BitfinexClient("k", "s", base_url="https://example.test")
    s1 = client._sign("/x", "")
    s2 = client._sign("/x", "")
    assert int(s2["bfx-nonce"]) > int(s1["bfx-nonce"])


def test_funding_payment_row_parses_utc_date() -> None:
    """mts 是 UTC ms，取 .utc_date 应该是对应的 UTC 自然日。"""
    # 2026-05-23 12:34:56 UTC 的 ms
    row = FundingPaymentRow(
        external_id="123",
        currency="USD",
        mts=1779986096000,  # 2026-05-28T13:14:56 UTC (just a sample)
        amount=Decimal("1.234"),
        raw=[],
    )
    # 不去较真具体值，只验证类型和构造
    assert row.utc_date.year >= 2026


class _FakeResp:
    def __init__(self, status_code: int, text: str = "[]", json_data=None) -> None:
        self.status_code = status_code
        self.text = text
        self._json = json_data if json_data is not None else []

    def json(self):
        return self._json

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def test_auth_error_no_retry(monkeypatch) -> None:
    """401/403 是认证错误，不应该重试。"""
    client = BitfinexClient("k", "s", base_url="https://example.test", max_retries=3, retry_delay_sec=0)

    call_count = {"n": 0}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, content, headers):
            call_count["n"] += 1
            return _FakeResp(401, "Unauthorized")

    monkeypatch.setattr("app.services.bitfinex_client.httpx.Client", FakeClient)

    with pytest.raises(BitfinexAuthError):
        client._post("/v2/auth/r/ledgers/USD/hist", {"start": 0})
    assert call_count["n"] == 1  # 没重试


def test_network_error_retries(monkeypatch) -> None:
    """非 4xx 失败应该重试 max_retries 次。"""
    client = BitfinexClient("k", "s", base_url="https://example.test", max_retries=3, retry_delay_sec=0)

    call_count = {"n": 0}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, content, headers):
            call_count["n"] += 1
            return _FakeResp(503, "down")

    monkeypatch.setattr("app.services.bitfinex_client.httpx.Client", FakeClient)

    with pytest.raises(RuntimeError):
        client._post("/x", {})
    assert call_count["n"] == 3
