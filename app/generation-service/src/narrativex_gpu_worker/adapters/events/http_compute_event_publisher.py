from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import UTC, datetime

import httpx

LOGGER = logging.getLogger("narrativex.gpu_worker.adapters.events")


class HttpComputeEventPublisher:
    """Delivers signed sequenced observations to the backend callback endpoint."""

    def __init__(
        self,
        callback_url: str,
        shared_secret: str,
        http_client: httpx.AsyncClient | None = None,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._callback_url = callback_url
        self._shared_secret = shared_secret
        self._client = http_client or httpx.AsyncClient(timeout=timeout_seconds)
        self._owns_client = http_client is None

    async def publish(self, payload_json: str) -> bool:
        if not self._callback_url.strip():
            LOGGER.debug("No callback URL configured; skipping publication")
            return True

        timestamp_ms = str(int(datetime.now(UTC).timestamp() * 1000))
        to_sign = f"{timestamp_ms}.{payload_json}".encode()
        signature = hmac.new(
            self._shared_secret.encode("utf-8"),
            to_sign,
            hashlib.sha256,
        ).hexdigest()

        headers = {
            "Content-Type": "application/vnd.narrativex.compute-v1+json",
            "X-NarrativeX-Compute-Signature": signature,
            "X-NarrativeX-Compute-Timestamp": timestamp_ms,
        }

        try:
            response = await self._client.post(
                self._callback_url,
                content=payload_json,
                headers=headers,
            )
            if 200 <= response.status_code < 300:
                return True
            LOGGER.warning(
                "Backend callback endpoint returned HTTP %s for event publication",
                response.status_code,
            )
            return False
        except Exception as exc:
            LOGGER.warning(
                "Error publishing event to backend at %s: %s",
                self._callback_url,
                exc,
            )
            return False

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()


__all__ = ["HttpComputeEventPublisher"]
