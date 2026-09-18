from __future__ import annotations

import asyncio
from collections.abc import Awaitable
from contextlib import suppress
from typing import Any

import httpx

from narrativex_gpu_worker.application.errors import ExecutionCanceledError


class VieNeuClientError(RuntimeError):
    """VieNeu HTTP API client error."""


class VieNeuClient:
    """HTTP client for VieNeu Vietnamese TTS API."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8008",
        api_key: str | None = None,
        timeout: float = 300.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._client = client

    async def health(self) -> bool:
        try:
            if self._client is not None:
                resp = await self._client.get(f"{self.base_url}/healthz", timeout=5.0)
            else:
                async with httpx.AsyncClient(timeout=5.0) as cl:
                    resp = await cl.get(f"{self.base_url}/healthz")
            return resp.status_code == 200
        except Exception:
            return False

    async def voices(self) -> list[dict[str, Any]]:
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        try:
            if self._client is not None:
                resp = await self._client.get(
                    f"{self.base_url}/v1/voices", headers=headers, timeout=self.timeout
                )
            else:
                async with httpx.AsyncClient(timeout=self.timeout) as cl:
                    resp = await cl.get(f"{self.base_url}/v1/voices", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data
                if isinstance(data, dict) and "voices" in data:
                    return data["voices"]  # type: ignore[no-any-return]
            return []
        except Exception:
            return []

    async def synthesize(
        self,
        text: str,
        voice: str = "vieneu-default",
        speed: float = 1.0,
        temperature: float = 0.7,
        cancel: asyncio.Event | None = None,
    ) -> bytes:
        headers = {"Accept": "audio/wav"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": "vieneu-v3-turbo",
            "input": text,
            "text": text,
            "voice": voice,
            "speed": speed,
            "temperature": temperature,
            "response_format": "wav",
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
            raise VieNeuClientError(
                f"VieNeu synthesis failed with status {response.status_code}: {response.text}"
            )
        return response.content

    async def synthesize_reference(
        self,
        text: str,
        reference_wav: bytes,
        voice: str = "vieneu-clone",
        speed: float = 1.0,
        temperature: float = 0.7,
        cancel: asyncio.Event | None = None,
    ) -> bytes:
        headers = {"Accept": "audio/wav"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        data = {
            "text": text,
            "voice": voice,
            "speed": str(speed),
            "temperature": str(temperature),
            "model": "vieneu-v3-turbo",
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
            raise VieNeuClientError(
                f"VieNeu reference synthesis failed with status {response.status_code}: "
                f"{response.text}"
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
                raise ExecutionCanceledError("VieNeu execution canceled")
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


__all__ = ["VieNeuClient", "VieNeuClientError"]
