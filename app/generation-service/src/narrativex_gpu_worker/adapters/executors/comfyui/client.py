from __future__ import annotations

import asyncio
from typing import Any
from urllib.parse import quote

import httpx

from narrativex_gpu_worker.application.errors import ExecutionCanceledError


class ComfyUIClientError(RuntimeError):
    """ComfyUI client operation error."""


class ComfyUIClient:
    """HTTP client for the ComfyUI API."""

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


    async def download_image(
        self, filename: str, subfolder: str = "", folder_type: str = "output"
    ) -> bytes:
        params = {"filename": filename, "subfolder": subfolder, "type": folder_type}
        if self._client is not None:
            response = await self._client.get(
                f"{self.base_url}/view", params=params, timeout=self.timeout
            )
        else:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/view", params=params)
        if response.is_error:
            raise ComfyUIClientError(
                f"ComfyUI image download failed with HTTP {response.status_code}"
            )
        return response.content


__all__ = ["ComfyUIClient", "ComfyUIClientError"]
