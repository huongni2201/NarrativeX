from __future__ import annotations

from typing import Any


class WhisperXClientError(RuntimeError):
    """WhisperX alignment client error."""


class WhisperXClient:
    """Client for WhisperX word-level alignment service."""

    def __init__(self, endpoint_url: str | None = None) -> None:
        self.endpoint_url = endpoint_url

    async def align(
        self,
        audio_bytes: bytes,
        script: str,
        language: str = "vi",
        model: str = "large-v3",
    ) -> list[dict[str, Any]]:
        raise WhisperXClientError("WhisperX alignment engine is not configured or unavailable")


__all__ = ["WhisperXClient", "WhisperXClientError"]
