"""HTTP client for OpenAI-compatible LLM endpoints (e.g., local vLLM Qwen)."""

from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class QwenClientError(RuntimeError):
    """Raised when the LLM provider fails or returns invalid responses."""


class QwenClient:
    """Client for local Qwen / OpenAI-compatible /chat/completions endpoint."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000/v1",
        api_key: str = "",
        timeout_seconds: float = 600.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self._client = client

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        model: str = "Qwen/Qwen3-8B-AWQ",
        temperature: float = 0.2,
        top_p: float = 0.8,
        max_tokens: int = 16384,
        response_format: str = "text",
        cancel: asyncio.Event | None = None,
    ) -> tuple[str, str | None]:
        """Call /chat/completions and return (content, response_id)."""
        endpoint = f"{self.base_url}/chat/completions"
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "chat_template_kwargs": {"enable_thinking": False},
        }
        if response_format == "json_object":
            payload["response_format"] = {"type": "json_object"}

        timeout = httpx.Timeout(
            connect=10.0,
            write=30.0,
            read=self.timeout_seconds,
            pool=10.0,
        )

        try:
            response = await self._post_with_cancellation(
                endpoint=endpoint,
                payload=payload,
                headers=headers,
                timeout=timeout,
                cancel=cancel,
            )
            if response.status_code != 200:
                raise QwenClientError(
                    f"Qwen endpoint returned HTTP {response.status_code}: {response.text[:200]}"
                )
            data = response.json()
        except httpx.RequestError as exc:
            raise QwenClientError(f"Qwen request failed: {exc}") from exc

        choices = data.get("choices")
        if not choices or not isinstance(choices, list):
            raise QwenClientError("Invalid response from Qwen: missing choices")

        content = choices[0].get("message", {}).get("content", "")
        response_id = data.get("id")
        return content, response_id

    async def _post_with_cancellation(
        self,
        *,
        endpoint: str,
        payload: dict[str, Any],
        headers: dict[str, str],
        timeout: httpx.Timeout,
        cancel: asyncio.Event | None,
    ) -> httpx.Response:
        request = asyncio.create_task(
            self._post(endpoint=endpoint, payload=payload, headers=headers, timeout=timeout)
        )
        if cancel is None:
            return await request

        cancellation = asyncio.create_task(cancel.wait())
        done, _ = await asyncio.wait(
            (request, cancellation), return_when=asyncio.FIRST_COMPLETED
        )
        if cancellation in done:
            request.cancel()
            with suppress(asyncio.CancelledError):
                await request
            raise asyncio.CancelledError

        cancellation.cancel()
        with suppress(asyncio.CancelledError):
            await cancellation
        return await request

    async def _post(
        self,
        *,
        endpoint: str,
        payload: dict[str, Any],
        headers: dict[str, str],
        timeout: httpx.Timeout,
    ) -> httpx.Response:
        if self._client is not None:
            return await self._client.post(endpoint, json=payload, headers=headers, timeout=timeout)
        async with httpx.AsyncClient(timeout=timeout) as client:
            return await client.post(endpoint, json=payload, headers=headers)


__all__ = ["QwenClient", "QwenClientError"]
