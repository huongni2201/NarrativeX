from __future__ import annotations

from typing import Any

import httpx
import pytest

import narrativex_worker.gpu_ownership as gpu_ownership
from narrativex_worker.config import WorkerSettings
from narrativex_worker.gpu_ownership import (
    GlobalGpuLease,
    GpuOwner,
    GpuOwnershipError,
    GpuResidencyController,
)


def _settings() -> WorkerSettings:
    return WorkerSettings(
        worker_env="test",
        qwen_base_url="http://qwen:8000/v1",
        realvisxl_base_url="http://comfyui:8188",
        voicestudio_base_url="http://voicestudio:3900",
        voicestudio_api_key="voice-secret",
    )


class _FakeAdvisoryConnection:
    def __init__(self, lock_results: list[bool]) -> None:
        self.lock_results = lock_results
        self.fetchval_calls: list[tuple[str, tuple[object, ...]]] = []
        self.execute_calls: list[tuple[str, tuple[object, ...]]] = []
        self.closed = False

    async def fetchval(self, query: str, *args: object) -> object:
        self.fetchval_calls.append((query, args))
        if self.lock_results:
            return self.lock_results.pop(0)
        return False

    async def execute(self, query: str, *args: object) -> str:
        self.execute_calls.append((query, args))
        return "SELECT 1"

    async def close(self) -> None:
        self.closed = True


class _FakeController:
    def __init__(self) -> None:
        self.activated: list[GpuOwner] = []

    async def activate(self, owner: GpuOwner) -> None:
        self.activated.append(owner)

    async def aclose(self) -> None:
        return None


@pytest.mark.asyncio
async def test_global_gpu_lease_retries_try_lock_then_releases_owned_lock(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = _FakeAdvisoryConnection([False, True])
    controller = _FakeController()

    async def connect(*args: Any, **kwargs: Any) -> _FakeAdvisoryConnection:
        return connection

    monkeypatch.setattr(gpu_ownership.asyncpg, "connect", connect)
    monkeypatch.setattr(gpu_ownership, "_GPU_LOCK_POLL_SECONDS", 0.0)

    async with GlobalGpuLease(
        _settings(),
        GpuOwner.QWEN,
        controller=controller,  # type: ignore[arg-type]
    ):
        assert controller.activated == [GpuOwner.QWEN]
        assert connection.closed is False

    assert len(connection.fetchval_calls) == 2
    assert all("pg_try_advisory_lock" in query for query, _ in connection.fetchval_calls)
    assert len(connection.execute_calls) == 1
    assert "pg_advisory_unlock" in connection.execute_calls[0][0]
    assert connection.closed is True


@pytest.mark.asyncio
async def test_global_gpu_lease_times_out_without_unlocking_unowned_lock(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = _FakeAdvisoryConnection([])
    controller = _FakeController()
    settings = _settings()
    settings.gpu_transition_timeout_seconds = 0.01

    async def connect(*args: Any, **kwargs: Any) -> _FakeAdvisoryConnection:
        return connection

    monkeypatch.setattr(gpu_ownership.asyncpg, "connect", connect)
    monkeypatch.setattr(gpu_ownership, "_GPU_LOCK_POLL_SECONDS", 0.001)

    with pytest.raises(GpuOwnershipError, match="GPU_OWNERSHIP_TIMEOUT"):
        async with GlobalGpuLease(
            settings,
            GpuOwner.REALVISXL,
            controller=controller,  # type: ignore[arg-type]
        ):
            raise AssertionError("lease must not be entered")

    assert connection.fetchval_calls
    assert connection.execute_calls == []
    assert connection.closed is True
    assert controller.activated == []


@pytest.mark.asyncio
async def test_realvisxl_transition_sleeps_qwen_waits_for_idle_and_unloads_voice() -> None:
    requests: list[tuple[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append((request.method, request.url.path))
        if request.url.path == "/is_sleeping":
            return httpx.Response(200, json={"is_sleeping": False})
        if request.url.path == "/sleep":
            return httpx.Response(200, json={"status": "success"})
        if request.url.path == "/queue":
            return httpx.Response(200, json={"queue_running": [], "queue_pending": []})
        if request.url.path == "/system/flush-memory":
            assert request.headers["authorization"] == "Bearer voice-secret"
            assert request.url.params["unload_model"] == "true"
            return httpx.Response(200, json={"status": "success"})
        raise AssertionError(f"unexpected request: {request.method} {request.url}")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        controller = GpuResidencyController(_settings(), client=client)
        await controller.activate(GpuOwner.REALVISXL)

    assert requests == [
        ("GET", "/is_sleeping"),
        ("POST", "/sleep"),
        ("GET", "/queue"),
        ("POST", "/system/flush-memory"),
    ]


@pytest.mark.asyncio
async def test_qwen_transition_frees_comfyui_and_unloads_voice_before_wake() -> None:
    requests: list[tuple[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append((request.method, request.url.path))
        if request.url.path == "/queue":
            return httpx.Response(200, json={"queue_running": [], "queue_pending": []})
        if request.url.path == "/free":
            assert request.method == "POST"
            return httpx.Response(200, json={"status": "success"})
        if request.url.path == "/system/flush-memory":
            return httpx.Response(200, json={"status": "success"})
        if request.url.path == "/is_sleeping":
            return httpx.Response(200, json={"is_sleeping": True})
        if request.url.path == "/wake_up":
            return httpx.Response(200, json={"status": "success"})
        raise AssertionError(f"unexpected request: {request.method} {request.url}")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        controller = GpuResidencyController(_settings(), client=client)
        await controller.activate(GpuOwner.QWEN)

    assert requests == [
        ("GET", "/queue"),
        ("POST", "/free"),
        ("POST", "/system/flush-memory"),
        ("GET", "/is_sleeping"),
        ("POST", "/wake_up"),
    ]


@pytest.mark.asyncio
async def test_voicestudio_transition_sleeps_qwen_and_frees_comfyui() -> None:
    requests: list[tuple[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append((request.method, request.url.path))
        if request.url.path == "/is_sleeping":
            return httpx.Response(200, json={"is_sleeping": False})
        if request.url.path == "/sleep":
            return httpx.Response(200, json={"status": "success"})
        if request.url.path == "/queue":
            return httpx.Response(200, json={"queue_running": [], "queue_pending": []})
        if request.url.path == "/free":
            return httpx.Response(200, json={"status": "success"})
        raise AssertionError(f"unexpected request: {request.method} {request.url}")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        controller = GpuResidencyController(_settings(), client=client)
        await controller.activate(GpuOwner.VOICESTUDIO)

    assert requests == [
        ("GET", "/is_sleeping"),
        ("POST", "/sleep"),
        ("GET", "/queue"),
        ("POST", "/free"),
    ]
