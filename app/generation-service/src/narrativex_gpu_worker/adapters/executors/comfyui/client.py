from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import quote

import httpx
import websockets

from narrativex_gpu_worker.application.errors import ExecutionCanceledError

LOGGER = logging.getLogger("narrativex.gpu_worker.comfyui")


class ComfyUIClientError(RuntimeError):
    """ComfyUI client operation error."""


class ComfyUIClient:
    """HTTP and WebSocket client for the ComfyUI API."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8188",
        timeout: float = 120.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = client

    async def submit_prompt(self, workflow: dict[str, Any], client_id: str) -> str:
        body = {"prompt": workflow, "client_id": client_id}
        if self._client is not None:
            response = await self._client.post(
                f"{self.base_url}/prompt", json=body, timeout=self.timeout
            )
        else:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}/prompt", json=body)

        if response.is_error:
            raise ComfyUIClientError(
                f"ComfyUI prompt submission failed with HTTP {response.status_code}"
            )
        data = response.json()
        prompt_id = data.get("prompt_id")
        if not isinstance(prompt_id, str) or not prompt_id:
            raise ComfyUIClientError("ComfyUI response did not return a valid prompt_id")
        return prompt_id

    async def get_history(self, prompt_id: str) -> dict[str, Any] | None:
        """Fetch history record once for durable reconciliation."""
        url = f"{self.base_url}/history/{quote(prompt_id, safe='')}"
        if self._client is not None:
            response = await self._client.get(url, timeout=self.timeout)
        else:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)

        if response.status_code == 200:
            history = response.json()
            if prompt_id in history:
                record = history[prompt_id]
                status = record.get("status", {})
                if status.get("completed") or status.get("status_str") == "success":
                    return record  # type: ignore[no-any-return]
                if status.get("status_str") in {"error", "failed"}:
                    raise ComfyUIClientError(
                        f"ComfyUI execution failed: {status.get('messages')}"
                    )
                if record.get("outputs"):
                    return record  # type: ignore[no-any-return]
        return None

    async def wait_for_completion(
        self, prompt_id: str, client_id: str, cancel: asyncio.Event
    ) -> dict[str, Any]:
        """Wait for execution completion using WebSocket live path with History API fallback."""
        record = await self.get_history(prompt_id)
        if record is not None:
            return record

        try:
            return await self._wait_via_websocket(prompt_id, client_id, cancel)
        except (ExecutionCanceledError, ComfyUIClientError):
            raise
        except Exception as exc:
            LOGGER.debug("ComfyUI WebSocket failed (%s); falling back to History API polling", exc)
            return await self.poll_history(prompt_id, cancel)

    async def _wait_via_websocket(
        self, prompt_id: str, client_id: str, cancel: asyncio.Event
    ) -> dict[str, Any]:
        ws_url = self.base_url.replace("http://", "ws://").replace("https://", "wss://")
        ws_endpoint = f"{ws_url}/ws?clientId={quote(client_id, safe='')}"
        async with websockets.connect(ws_endpoint, open_timeout=5.0, close_timeout=2.0) as ws:
            while not cancel.is_set():
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                except TimeoutError:
                    continue

                if isinstance(msg, bytes):
                    continue

                try:
                    payload = json.loads(msg)
                except Exception:
                    continue

                msg_type = payload.get("type")
                data = payload.get("data", {})
                msg_prompt_id = data.get("prompt_id")

                if msg_type == "execution_error" and msg_prompt_id == prompt_id:
                    raise ComfyUIClientError(
                        f"ComfyUI execution failed: {data.get('exception_message')}"
                    )

                if (
                    msg_type == "executing"
                    and msg_prompt_id == prompt_id
                    and data.get("node") is None
                ):
                    history = await self.get_history(prompt_id)
                    if history is not None:
                        return history
                    return await self.poll_history(prompt_id, cancel, poll_interval=0.1)

            raise ExecutionCanceledError("ComfyUI execution canceled")

    async def poll_history(
        self, prompt_id: str, cancel: asyncio.Event, poll_interval: float = 1.0
    ) -> dict[str, Any]:
        url = f"{self.base_url}/history/{quote(prompt_id, safe='')}"
        while not cancel.is_set():
            if self._client is not None:
                response = await self._client.get(url, timeout=self.timeout)
            else:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(url)

            if response.status_code == 200:
                history = response.json()
                if prompt_id in history:
                    record = history[prompt_id]
                    status = record.get("status", {})
                    if status.get("completed") or status.get("status_str") == "success":
                        return record  # type: ignore[no-any-return]
                    if status.get("status_str") in {"error", "failed"}:
                        raise ComfyUIClientError(
                            f"ComfyUI execution failed: {status.get('messages')}"
                        )
                    if record.get("outputs"):
                        return record  # type: ignore[no-any-return]
            await asyncio.sleep(poll_interval)
        raise ExecutionCanceledError("ComfyUI execution canceled")

    async def download_image_stream(
        self,
        filename: str,
        subfolder: str = "",
        folder_type: str = "output",
        chunk_size: int = 65536,
    ) -> AsyncIterator[bytes]:
        params = {"filename": filename, "subfolder": subfolder, "type": folder_type}
        url = f"{self.base_url}/view"
        client = self._client or httpx.AsyncClient(timeout=self.timeout)
        close_client = self._client is None
        try:
            async with client.stream("GET", url, params=params) as response:
                if response.is_error:
                    raise ComfyUIClientError(
                        f"ComfyUI image download failed with HTTP {response.status_code}"
                    )
                async for chunk in response.aiter_bytes(chunk_size=chunk_size):
                    yield chunk
        finally:
            if close_client:
                await client.aclose()

    async def download_image(
        self, filename: str, subfolder: str = "", folder_type: str = "output"
    ) -> bytes:
        chunks: list[bytes] = []
        async for chunk in self.download_image_stream(filename, subfolder, folder_type):
            chunks.append(chunk)
        return b"".join(chunks)


__all__ = ["ComfyUIClient", "ComfyUIClientError"]
