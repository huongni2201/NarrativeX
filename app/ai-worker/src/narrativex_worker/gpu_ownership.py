"""Cross-process single-GPU ownership and model-residency transitions.

NarrativeX runs Qwen, ComfyUI/RealVisXL and VoiceStudio as separate processes/services. A local
asyncio semaphore cannot serialize those processes, so every GPU stage acquires one PostgreSQL
session-level advisory lock before touching CUDA. The same database already owns durable worker
state, and PostgreSQL automatically releases the lock when a crashed worker loses its connection.

Holding the lock is only half of the safety boundary: before a new owner runs, every other model
runtime is explicitly asked to release GPU memory. Qwen uses vLLM sleep mode, ComfyUI unloads its
models/cache, and VoiceStudio unloads its resident TTS engine. The active owner is also released on
normal exit so idle services do not pin VRAM on the RTX 4060.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from enum import StrEnum
from typing import Protocol

import asyncpg  # type: ignore[import-untyped]
import httpx

from narrativex_worker.config import WorkerSettings

# Stable signed 64-bit advisory-lock key. There is intentionally one GPU ownership domain per DB.
_GPU_ADVISORY_LOCK_KEY = 5_837_216_904_260_118_219


class GpuOwner(StrEnum):
    QWEN = "qwen"
    REALVISXL = "realvisxl"
    VOICESTUDIO = "voicestudio"


class GpuOwnershipError(RuntimeError):
    """The global GPU ownership boundary could not be established safely."""


class _AdvisoryConnection(Protocol):
    async def execute(self, query: str, *args: object) -> str: ...

    async def close(self) -> None: ...


class GpuResidencyController:
    """Move one physical GPU between local model services without overlapping residency."""

    def __init__(
        self,
        settings: WorkerSettings,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings
        self.logger = logging.getLogger("narrativex.worker.gpu-residency")
        self.timeout_seconds = float(os.getenv("GPU_TRANSITION_TIMEOUT_SECONDS", "600"))
        self.comfyui_idle_poll_seconds = float(os.getenv("GPU_COMFYUI_IDLE_POLL_SECONDS", "0.5"))
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=5.0,
                write=30.0,
                read=self.timeout_seconds,
                pool=5.0,
            ),
            follow_redirects=False,
        )

    async def activate(self, owner: GpuOwner) -> None:
        """Evict every competing runtime, then make the requested owner runnable."""

        started = time.monotonic()
        if owner is not GpuOwner.QWEN:
            await self._sleep_qwen()
        if owner is not GpuOwner.REALVISXL:
            await self._drain_and_free_comfyui()
        if owner is not GpuOwner.VOICESTUDIO:
            await self._unload_voicestudio()
        if owner is GpuOwner.QWEN:
            await self._wake_qwen()
        self.logger.info(
            "GPU owner activated owner=%s transitionSeconds=%.3f",
            owner.value,
            time.monotonic() - started,
        )

    async def release(self, owner: GpuOwner) -> None:
        """Release the active runtime so idle services never pin scarce VRAM."""

        if owner is GpuOwner.QWEN:
            await self._sleep_qwen()
        elif owner is GpuOwner.REALVISXL:
            await self._drain_and_free_comfyui()
        elif owner is GpuOwner.VOICESTUDIO:
            await self._unload_voicestudio()
        self.logger.info("GPU owner released owner=%s", owner.value)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    @property
    def _qwen_origin(self) -> str:
        base = self.settings.qwen_base_url.rstrip("/")
        return base[:-3] if base.endswith("/v1") else base

    def _qwen_headers(self) -> dict[str, str]:
        if self.settings.qwen_api_key is None:
            return {}
        token = self.settings.qwen_api_key.get_secret_value().strip()
        return {"Authorization": f"Bearer {token}"} if token else {}

    def _voicestudio_headers(self) -> dict[str, str]:
        if self.settings.voicestudio_api_key is None:
            return {}
        token = self.settings.voicestudio_api_key.get_secret_value().strip()
        return {"Authorization": f"Bearer {token}"} if token else {}

    async def _sleep_qwen(self) -> None:
        endpoint = f"{self._qwen_origin}/sleep"
        try:
            response = await self._client.post(
                endpoint,
                params={"level": "1"},
                headers=self._qwen_headers(),
            )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise GpuOwnershipError("QWEN_SLEEP_UNREACHABLE") from exception
        self._require_success(response, "QWEN_SLEEP_FAILED")

    async def _wake_qwen(self) -> None:
        endpoint = f"{self._qwen_origin}/wake_up"
        try:
            response = await self._client.post(endpoint, headers=self._qwen_headers())
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise GpuOwnershipError("QWEN_WAKE_UNREACHABLE") from exception
        self._require_success(response, "QWEN_WAKE_FAILED")

    async def _drain_and_free_comfyui(self) -> None:
        await self._wait_comfyui_idle()
        try:
            response = await self._client.post(
                f"{self.settings.realvisxl_base_url.rstrip('/')}/free",
                json={"unload_models": True, "free_memory": True},
            )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise GpuOwnershipError("COMFYUI_FREE_UNREACHABLE") from exception
        self._require_success(response, "COMFYUI_FREE_FAILED")

    async def _wait_comfyui_idle(self) -> None:
        deadline = asyncio.get_running_loop().time() + self.timeout_seconds
        endpoint = f"{self.settings.realvisxl_base_url.rstrip('/')}/queue"
        while True:
            try:
                response = await self._client.get(endpoint)
            except (httpx.TimeoutException, httpx.NetworkError) as exception:
                raise GpuOwnershipError("COMFYUI_QUEUE_UNREACHABLE") from exception
            self._require_success(response, "COMFYUI_QUEUE_FAILED")
            try:
                payload = response.json()
            except ValueError as exception:
                raise GpuOwnershipError("COMFYUI_QUEUE_INVALID_JSON") from exception
            if not isinstance(payload, dict):
                raise GpuOwnershipError("COMFYUI_QUEUE_INVALID_RESPONSE")
            running = payload.get("queue_running")
            pending = payload.get("queue_pending")
            if isinstance(running, list) and isinstance(pending, list) and not running and not pending:
                return
            if asyncio.get_running_loop().time() >= deadline:
                raise GpuOwnershipError("COMFYUI_DRAIN_TIMEOUT")
            await asyncio.sleep(self.comfyui_idle_poll_seconds)

    async def _unload_voicestudio(self) -> None:
        endpoint = f"{self.settings.voicestudio_base_url.rstrip('/')}/system/flush-memory"
        try:
            response = await self._client.post(
                endpoint,
                params={"unload_model": "true"},
                headers=self._voicestudio_headers(),
            )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise GpuOwnershipError("VOICESTUDIO_UNLOAD_UNREACHABLE") from exception
        self._require_success(response, "VOICESTUDIO_UNLOAD_FAILED")

    @staticmethod
    def _require_success(response: httpx.Response, code: str) -> None:
        if response.is_error:
            raise GpuOwnershipError(f"{code}:HTTP_{response.status_code}")


class GlobalGpuLease:
    """Session-level PostgreSQL advisory lock plus residency transition for one GPU owner."""

    def __init__(
        self,
        settings: WorkerSettings,
        owner: GpuOwner,
        *,
        controller: GpuResidencyController | None = None,
    ) -> None:
        self.settings = settings
        self.owner = owner
        self.controller = controller or GpuResidencyController(settings)
        self._owns_controller = controller is None
        self._connection: _AdvisoryConnection | None = None
        self.logger = logging.getLogger("narrativex.worker.gpu-ownership")

    async def __aenter__(self) -> "GlobalGpuLease":
        started = time.monotonic()
        connection = await asyncpg.connect(self.settings.database_url)
        self._connection = connection
        try:
            await connection.execute(
                "SELECT pg_advisory_lock($1::bigint)",
                _GPU_ADVISORY_LOCK_KEY,
            )
            self.logger.info(
                "GPU advisory lock acquired owner=%s waitSeconds=%.3f",
                self.owner.value,
                time.monotonic() - started,
            )
            await self.controller.activate(self.owner)
            return self
        except BaseException:
            await self._release_lock(close_controller=True)
            raise

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        release_error: BaseException | None = None
        try:
            await self.controller.release(self.owner)
        except BaseException as exception:  # release must not leak the advisory lock
            release_error = exception
            self.logger.exception("GPU owner release failed owner=%s", self.owner.value)
        finally:
            await self._release_lock(close_controller=True)
        if release_error is not None and exc is None:
            raise release_error

    async def _release_lock(self, *, close_controller: bool) -> None:
        connection = self._connection
        self._connection = None
        if connection is not None:
            try:
                await connection.execute(
                    "SELECT pg_advisory_unlock($1::bigint)",
                    _GPU_ADVISORY_LOCK_KEY,
                )
            finally:
                await connection.close()
            self.logger.info("GPU advisory lock released owner=%s", self.owner.value)
        if close_controller and self._owns_controller:
            await self.controller.aclose()


def gpu_lease(settings: WorkerSettings, owner: GpuOwner) -> GlobalGpuLease:
    return GlobalGpuLease(settings, owner)


__all__ = [
    "GlobalGpuLease",
    "GpuOwner",
    "GpuOwnershipError",
    "GpuResidencyController",
    "gpu_lease",
]
