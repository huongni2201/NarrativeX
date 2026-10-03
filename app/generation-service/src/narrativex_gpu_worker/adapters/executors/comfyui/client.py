from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import quote

import httpx
import websockets

from narrativex_gpu_worker.application.errors import AmbiguousOutcomeError, ExecutionCanceledError

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

    async def upload_file(
        self,
        filename: str,
        content: bytes,
        mime_type: str = "image/png",
        subfolder: str = "",
        overwrite: bool = True,
    ) -> str:
        """Upload file content to ComfyUI input directory via multipart/form-data.

        Returns the filename assigned by ComfyUI.
        """
        files = {"image": (filename, content, mime_type)}
        data: dict[str, str] = {"overwrite": "true" if overwrite else "false"}
        if subfolder:
            data["subfolder"] = subfolder

        url = f"{self.base_url}/upload/image"
        if self._client is not None:
            response = await self._client.post(url, files=files, data=data, timeout=self.timeout)
        else:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, files=files, data=data)

        if response.is_error:
            raise ComfyUIClientError(
                f"ComfyUI file upload failed with HTTP {response.status_code}: {response.text}"
            )
        res_json = response.json()
        name = res_json.get("name", filename)
        return str(name)

    async def submit_prompt(
        self, workflow: dict[str, Any], client_id: str, prompt_id: str | None = None
    ) -> str:
        body = {"prompt": workflow, "client_id": client_id}
        if prompt_id is not None:
            body["prompt_id"] = prompt_id
        try:
            response = await self._request("POST", "/prompt", json=body)
        except httpx.HTTPError as exc:
            if prompt_id is not None and await self.find_prompt(prompt_id):
                return prompt_id
            raise AmbiguousOutcomeError("ComfyUI submission acknowledgment was lost") from exc
        if response.status_code == 400:
            raise ComfyUIClientError("ComfyUI rejected the prompt graph")
        try:
            acknowledged = response.json().get("prompt_id")
        except ValueError, AttributeError:
            acknowledged = None
        if response.is_error or not isinstance(acknowledged, str) or not acknowledged:
            if prompt_id is not None and await self.find_prompt(prompt_id):
                return prompt_id
            raise AmbiguousOutcomeError(
                f"ComfyUI submission outcome is unresolved (HTTP {response.status_code})"
            )
        if prompt_id is not None and acknowledged != prompt_id:
            raise AmbiguousOutcomeError("ComfyUI returned a different prompt correlation")
        return acknowledged

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        if self._client is not None:
            return await self._client.request(
                method, f"{self.base_url}{path}", timeout=self.timeout, **kwargs
            )
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            return await client.request(method, f"{self.base_url}{path}", **kwargs)

    async def object_info(self) -> dict[str, Any]:
        response = await self._request("GET", "/object_info")
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return data

    async def find_prompt(self, prompt_id: str) -> bool:
        """A missing history row is not permission to repeat POST /prompt."""
        try:
            response = await self._request("GET", f"/history/{quote(prompt_id, safe='')}")
            response.raise_for_status()
            if prompt_id in response.json():
                return True
            response = await self._request("GET", "/queue")
            response.raise_for_status()
            queue = response.json()
            return any(
                len(item) > 1 and item[1] == prompt_id
                for key in ("queue_running", "queue_pending")
                for item in queue.get(key, [])
            )
        except httpx.HTTPError, ValueError, TypeError, AttributeError:
            return False

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
                if status.get("status_str") in {"error", "failed"}:
                    raise ComfyUIClientError(f"ComfyUI execution failed: {status.get('messages')}")
                if status.get("completed") or status.get("status_str") == "success":
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
        except AmbiguousOutcomeError, ExecutionCanceledError, ComfyUIClientError:
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

            raise AmbiguousOutcomeError("ComfyUI cancellation is unconfirmed")

    async def poll_history(
        self, prompt_id: str, cancel: asyncio.Event, poll_interval: float = 1.0
    ) -> dict[str, Any]:
        interval = max(0.5, poll_interval)
        for _ in range(600):
            if cancel.is_set():
                raise AmbiguousOutcomeError("ComfyUI cancellation is unconfirmed")
            record = await self.get_history(prompt_id)
            if record is not None:
                return record
            try:
                await asyncio.wait_for(cancel.wait(), timeout=interval)
            except TimeoutError:
                pass
            interval = min(5.0, interval * 1.5)
        raise AmbiguousOutcomeError("ComfyUI completion remains unresolved")

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
