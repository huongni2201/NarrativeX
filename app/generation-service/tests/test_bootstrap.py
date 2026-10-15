from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from pydantic import SecretStr

from narrativex_gpu_worker.bootstrap import build_application
from narrativex_gpu_worker.config import WorkerSettings


@pytest.mark.parametrize("failure_stage", ["prepare", "execution", "outbox"])
async def test_lifespan_cleans_resources_when_startup_fails(tmp_path, failure_stage):
    from narrativex_gpu_worker.adapters.inbound.http.app import AppState, create_app

    prepare = AsyncMock()
    execution = AsyncMock()
    outbox = AsyncMock()
    close = AsyncMock()
    stages = {"prepare": prepare, "execution": execution.start, "outbox": outbox.start}
    stages[failure_stage].side_effect = RuntimeError("startup failed")
    state = AppState(
        settings=WorkerSettings(
            machine_token=SecretStr("test"), journal_file=tmp_path / "journal.sqlite3"
        ),
        executor_catalog=AsyncMock(),
        execution=execution,
        outbox=outbox,
        prepare_resources=prepare,
        close_resources=close,
    )
    app = create_app(state)
    with pytest.raises(RuntimeError, match="startup failed"):
        async with app.router.lifespan_context(app):
            pytest.fail("startup should fail before serving")
    execution.stop.assert_awaited_once()
    outbox.stop.assert_awaited_once()
    close.assert_awaited_once()


async def test_bootstrap_starts_managed_dependency_before_preflight(tmp_path, monkeypatch):
    from narrativex_gpu_worker.adapters.runtime.supervisor import RuntimeProcessSupervisor
    from narrativex_gpu_worker.application.ports.residency import RuntimeFamily

    events = []
    catalog = AsyncMock()
    catalog.preflight.side_effect = lambda: events.append("preflight")

    async def start(_self, family):
        assert family == RuntimeFamily.LTX_VIDEO
        events.append("start")

    async def stop(_self, family):
        events.append("stop")

    monkeypatch.setattr(RuntimeProcessSupervisor, "start", start)
    monkeypatch.setattr(RuntimeProcessSupervisor, "stop", stop)
    components = build_application(
        WorkerSettings(
            machine_token=SecretStr("test"),
            journal_file=tmp_path / "journal.sqlite3",
            comfyui_command="test-runtime",
            ltx_runtime_directory=tmp_path,
            residency_vram_probe_enabled=False,
            event_delivery_enabled=False,
        ),
        executor_catalog=catalog,
    )
    try:
        await components.prepare_resources()
        assert events == ["start", "preflight"]
        assert await components.residency.current_resident() == RuntimeFamily.LTX_VIDEO
    finally:
        await components.close()
    catalog.unload_runtime.assert_awaited_once_with(RuntimeFamily.LTX_VIDEO)
    assert events == ["start", "preflight", "stop"]


def test_production_catalog_registers_all_compute_workloads(tmp_path: Path) -> None:
    settings = WorkerSettings(
        machine_token=SecretStr("test-machine-token"),
        journal_file=tmp_path / "journal.sqlite3",
        vieneu_api_key=SecretStr("vieneu-key"),
    )
    components = build_application(settings)
    try:
        capabilities = {item.name: item for item in components.executor_catalog.capabilities()}
        assert set(capabilities) == {
            "comfyui",
            "ltx",
            "media-validator",
            "vieneu",
            "whisperx",
        }
        # The default ComfyUI URL cannot establish a pinned LTX runtime/model installation.
        assert capabilities["ltx"].ready is False
        assert capabilities["comfyui"].ready is True
        assert capabilities["vieneu"].ready is True
        assert capabilities["whisperx"].ready is settings.whisperx_available
    finally:
        # The production catalog owns one shared HTTP client.
        asyncio.run(components.close())


def test_canonical_generation_service_environment_is_supported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # BaseSettings reads the canonical GENERATION_SERVICE_* names.
    monkeypatch.setenv("GENERATION_SERVICE_MACHINE_TOKEN", "canonical-token")
    monkeypatch.setenv("GENERATION_SERVICE_HOST", "0.0.0.0")
    monkeypatch.setenv("GENERATION_SERVICE_PORT", "8123")
    monkeypatch.setenv("GENERATION_MAX_CONCURRENCY", "2")

    settings = WorkerSettings()

    assert settings.machine_token.get_secret_value() == "canonical-token"
    assert settings.host == "0.0.0.0"
    assert settings.port == 8123
    assert settings.max_concurrent_tasks == 2
