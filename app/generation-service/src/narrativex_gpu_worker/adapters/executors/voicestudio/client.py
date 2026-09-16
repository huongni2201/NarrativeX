from __future__ import annotations

import asyncio
from collections.abc import Awaitable
from contextlib import suppress

import httpx

from narrativex_gpu_worker.application.errors import ExecutionCanceledError


class VoiceStudioClientError(RuntimeError):
    """VoiceStudio HTTP API client error."""


class VoiceStudioClient:
    """HTTP client for VoiceStudio TTS API."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8000",
        api_key: str | None = None,
        timeout: float = 60.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._client = client

    async def synthesize(
        self,
        text: str,
        voice: str,
        model: str = "vi-profile",
        language: str | None = None,
        speed: float = 1.0,
        cancel: asyncio.Event | None = None,
    ) -> bytes:
        headers = {"Accept": "audio/wav"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": model,
            "voice": voice,
            "input": text,
            "response_format": "wav",
            "speed": speed,
            "language": language,
        }

        if self._client is not None:
            response = await self._await_response(
                self._client.post(
                    f"{self.base_url}/v1/audio/speech",
                    headers=headers,
                    json=payload,
                    timeout=self.timeout,
                ),
                cancel,
            )
        else:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await self._await_response(
                    client.post(
                        f"{self.base_url}/v1/audio/speech",
                        headers=headers,
                        json=payload,
                    ),
                    cancel,
                )

        if response.is_error:
            raise VoiceStudioClientError(
                f"VoiceStudio synthesis failed with status {response.status_code}"
            )
        return response.content

    async def synthesize_reference(
        self,
        text: str,
        reference_wav: bytes,
        model: str = "vi-profile",
        language: str | None = None,
        speed: float = 1.0,
        cancel: asyncio.Event | None = None,
    ) -> bytes:
        headers = {"Accept": "audio/wav"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        data = {
            "text": text,
            "language": language or "auto",
            "speed": str(speed),
            "engine": model,
            "stream": "false",
        }
        files = {"ref_audio": ("ref.wav", reference_wav, "audio/wav")}

        if self._client is not None:
            response = await self._await_response(
                self._client.post(
                    f"{self.base_url}/generate",
                    headers=headers,
                    data=data,
                    files=files,
                    timeout=self.timeout,
                ),
                cancel,
            )
        else:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await self._await_response(
                    client.post(
                        f"{self.base_url}/generate",
                        headers=headers,
                        data=data,
                        files=files,
                    ),
                    cancel,
                )

        if response.is_error:
            raise VoiceStudioClientError(
                f"VoiceStudio reference synthesis failed with status {response.status_code}"
            )
        return response.content

    async def _await_response(
        self,
        request: Awaitable[httpx.Response],
        cancel: asyncio.Event | None,
    ) -> httpx.Response:
        request_task = asyncio.ensure_future(request)
        cancellation_task: asyncio.Task[bool] | None = None
        try:
            if cancel is None:
                return await asyncio.shield(request_task)

            cancellation_task = asyncio.create_task(cancel.wait())
            done, _ = await asyncio.wait(
                (request_task, cancellation_task),
                return_when=asyncio.FIRST_COMPLETED,
            )
            if cancellation_task in done:
                request_task.cancel()
                with suppress(asyncio.CancelledError, Exception):
                    await request_task
                raise ExecutionCanceledError("VoiceStudio execution canceled")
            return await request_task
        except BaseException:
            if not request_task.done():
                request_task.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await request_task
            raise
        finally:
            if cancellation_task is not None and not cancellation_task.done():
                cancellation_task.cancel()
            if cancellation_task is not None:
                with suppress(asyncio.CancelledError, Exception):
                    await cancellation_task


__all__ = ["VoiceStudioClient", "VoiceStudioClientError"]
