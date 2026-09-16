from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from pydantic import SecretStr

from narrativex_gpu_worker.bootstrap import build_application
from narrativex_gpu_worker.config import WorkerSettings


def test_production_catalog_registers_all_compute_workloads(tmp_path: Path) -> None:
    settings = WorkerSettings(
        machine_token=SecretStr("test-machine-token"),
        journal_file=tmp_path / "journal.sqlite3",
        voicestudio_api_key=SecretStr("voice-key"),
    )
    components = build_application(settings)
    try:
        capabilities = {item.name: item for item in components.executor_catalog.capabilities()}
        assert set(capabilities) == {
            "comfyui",
            "media-validator",
            "qwen",
            "voicestudio",
            "whisperx",
        }
        assert capabilities["qwen"].ready is True
        assert capabilities["comfyui"].ready is True
        assert capabilities["voicestudio"].ready is True
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
