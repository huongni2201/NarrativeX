"""Tests for NarrativeX AI worker foundation."""

import pytest

from narrativex_worker.config import WorkerSettings, get_settings
from narrativex_worker.worker import NarrativeXWorker


def test_worker_settings_defaults() -> None:
    """Verify default worker configuration."""
    settings = get_settings()
    assert settings.worker_name == "narrativex-worker"
    assert settings.worker_env in ("development", "test")
    assert settings.log_level == "INFO"
    assert settings.backend_url == "http://localhost:8080"


def test_worker_custom_settings() -> None:
    """Verify worker accepts custom configuration overrides."""
    custom = WorkerSettings(
        worker_name="custom-worker",
        worker_env="test",
        log_level="DEBUG",
        backend_url="http://backend:8080",
    )
    assert custom.worker_name == "custom-worker"
    assert custom.worker_env == "test"
    assert custom.log_level == "DEBUG"
    assert custom.backend_url == "http://backend:8080"


@pytest.mark.asyncio
async def test_worker_dry_run_startup() -> None:
    """Verify worker can initialize, start in dry-run mode, and exit cleanly."""
    settings = WorkerSettings(worker_env="test", log_level="DEBUG")
    worker = NarrativeXWorker(settings=settings)
    # Dry run should return immediately without hanging
    await worker.start(dry_run=True)
    assert not worker._running


def test_worker_stop() -> None:
    """Verify worker stop signals clean shutdown flag."""
    worker = NarrativeXWorker()
    worker._running = True
    worker.stop()
    assert not worker._running
