from __future__ import annotations

import httpx
import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.gpu_ownership import GpuOwner, GpuResidencyController


def _settings() -> WorkerSettings:
    return WorkerSettings(
        worker_env="test",
        qwen_base_url="http://qwen:8000/v1",
        realvisxl_base_url="http://comfyui:8188",
        voicestudio_base_url="http://voicestudio:3900",
        voicestudio_api_key="voice-secret",
    )


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
