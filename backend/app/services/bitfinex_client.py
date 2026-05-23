"""Bitfinex v2 私有 API 客户端。

只暴露我们需要的方法：fetch_funding_payments(date, currency) → list[FundingPaymentRow]。
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Bitfinex Ledger category for margin funding interest payments (received)
FUNDING_PAYMENT_CATEGORY = 28
# Bitfinex API 单次最多返回 2500 条
MAX_LIMIT = 2500


@dataclass(frozen=True)
class FundingPaymentRow:
    external_id: str
    currency: str
    mts: int  # ms since epoch
    amount: Decimal
    raw: list  # 原始 Bitfinex 数组，用于 JSONB 存档

    @property
    def utc_date(self) -> date:
        return datetime.fromtimestamp(self.mts / 1000, tz=UTC).date()


class BitfinexAuthError(Exception):
    """API 凭证错误或签名失败。"""


class BitfinexClient:
    """同一个账号（一对 key/secret）一个 client 实例。"""

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        *,
        base_url: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay_sec: float = 30.0,
    ) -> None:
        self._key = api_key
        self._secret = api_secret.encode()
        self._base_url = (base_url or settings.BITFINEX_API_BASE).rstrip("/")
        self._timeout = timeout
        self._max_retries = max_retries
        self._retry_delay_sec = retry_delay_sec

    def _sign(self, api_path: str, body: str) -> dict[str, str]:
        nonce = str(int(time.time() * 1_000_000))
        sig_payload = f"/api{api_path}{nonce}{body}"
        signature = hmac.new(self._secret, sig_payload.encode(), hashlib.sha384).hexdigest()
        return {
            "bfx-nonce": nonce,
            "bfx-apikey": self._key,
            "bfx-signature": signature,
            "Content-Type": "application/json",
        }

    def _post(self, api_path: str, payload: dict) -> list:
        body = json.dumps(payload)
        url = self._base_url + api_path
        last_exc: Exception | None = None
        for attempt in range(1, self._max_retries + 1):
            try:
                headers = self._sign(api_path, body)
                with httpx.Client(timeout=self._timeout) as cli:
                    resp = cli.post(url, content=body, headers=headers)
                if resp.status_code == 200:
                    return resp.json()
                # Bitfinex 返回 4xx 一般是 ["error", code, message]
                if 400 <= resp.status_code < 500:
                    raise BitfinexAuthError(
                        f"Bitfinex {resp.status_code}: {resp.text[:200]}"
                    )
                resp.raise_for_status()
            except BitfinexAuthError:
                raise  # 不重试
            except Exception as e:  # noqa: BLE001
                last_exc = e
                logger.warning(
                    "Bitfinex %s attempt %d/%d failed: %s",
                    api_path,
                    attempt,
                    self._max_retries,
                    e,
                )
                if attempt < self._max_retries:
                    time.sleep(self._retry_delay_sec)
        raise RuntimeError(f"Bitfinex {api_path} failed after {self._max_retries} attempts") from last_exc

    def fetch_funding_payments(
        self, target_date: date, currency: str
    ) -> Iterable[FundingPaymentRow]:
        """返回 target_date（UTC 自然日）的全部 funding interest 流水。"""
        start_ms = int(datetime.combine(target_date, datetime.min.time(), UTC).timestamp() * 1000)
        end_ms = int(
            datetime.combine(target_date + timedelta(days=1), datetime.min.time(), UTC).timestamp()
            * 1000
        )
        api_path = f"/v2/auth/r/ledgers/{currency}/hist"
        payload = {
            "start": start_ms,
            "end": end_ms,
            "limit": MAX_LIMIT,
            "category": FUNDING_PAYMENT_CATEGORY,
        }
        raw_rows = self._post(api_path, payload)
        for row in raw_rows:
            # Bitfinex ledger row: [ID, CURRENCY, _, MTS, _, AMOUNT, BALANCE, _, DESCRIPTION]
            yield FundingPaymentRow(
                external_id=str(row[0]),
                currency=row[1],
                mts=int(row[3]),
                amount=Decimal(str(row[5])),
                raw=row,
            )
