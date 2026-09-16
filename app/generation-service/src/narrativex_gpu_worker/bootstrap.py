"""Composition root for the generation service.

Only this module knows which concrete adapters are used in a deployment. The
application service and inbound adapters receive ports instead of constructing
SQLite, HTTP or provider implementations themselves.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx
from fastapi import FastAPI

from narrativex_gpu_worker.adapters.artifacts import HttpArtifactAdapter
from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.executors.comfyui import ComfyUIClient, ComfyUIExecutor
from narrativex_gpu_worker.adapters.executors.media_validation import MediaValidationExecutor
from narrativex_gpu_worker.adapters.executors.qwen import QwenClient, QwenExecutor
from narrativex_gpu_worker.adapters.executors.voicestudio import (
    VoiceStudioClient,
    VoiceStudioExecutor,
)
from narrativex_gpu_worker.adapters.executors.whisperx import WhisperXClient, WhisperXExecutor
from narrativex_gpu_worker.adapters.inbound.http import AppState
from narrativex_gpu_worker.adapters.inbound.http import create_app as create_http_app
from narrativex_gpu_worker.adapters.persistence import SqliteExecutionJournalAdapter
from narrativex_gpu_worker.application.ports.executors import ExecutorCatalogPort
from narrativex_gpu_worker.application.services import ExecutionApplicationService
from narrativex_gpu_worker.config import WorkerSettings


@dataclass(frozen=True, slots=True)
class ApplicationComponents:
    settings: WorkerSettings
    executor_catalog: ExecutorCatalogPort
    execution: ExecutionApplicationService
    close_resources: Callable[[], Awaitable[None]] | None = None

    async def close(self) -> None:
        if self.close_resources is not None:
            await self.close_resources()


def build_executor_catalog(
    settings: WorkerSettings, client: httpx.AsyncClient
) -> ExecutorCatalogPort:
    """Build the configured production catalog without importing provider SDKs eagerly."""
    artifacts = HttpArtifactAdapter(client, settings.max_artifact_bytes)
    return ExecutorCatalog(
        (
            QwenExecutor(
                QwenClient(
                    base_url=settings.qwen_base_url,
                    api_key=settings.qwen_api_key.get_secret_value(),
                    timeout_seconds=settings.qwen_timeout_seconds,
                    client=client,
                ),
                artifacts,
                ready=bool(settings.qwen_base_url.strip()),
            ),
            ComfyUIExecutor(
                ComfyUIClient(
                    base_url=settings.comfyui_base_url,
                    timeout=settings.comfyui_timeout_seconds,
                    client=client,
                ),
                artifacts,
                ready=bool(settings.comfyui_base_url.strip()),
            ),
            VoiceStudioExecutor(
                VoiceStudioClient(
                    base_url=settings.voicestudio_base_url,
                    api_key=settings.voicestudio_api_key.get_secret_value() or None,
                    timeout=settings.voicestudio_timeout_seconds,
                    client=client,
                ),
                artifacts,
                ready=bool(
                    settings.voicestudio_base_url.strip()
                    and settings.voicestudio_api_key.get_secret_value().strip()
                ),
            ),
            WhisperXExecutor(
                WhisperXClient(
                    device=settings.whisperx_device,
                    align_model_name=settings.whisperx_align_model_name,
                ),
                artifacts,
                ready=settings.whisperx_available,
            ),
            MediaValidationExecutor(artifacts, ready=True),
        )
    )


def build_application(
    settings: WorkerSettings, executor_catalog: ExecutorCatalogPort | None = None
) -> ApplicationComponents:
    client: httpx.AsyncClient | None = None
    if executor_catalog is None:
        client = httpx.AsyncClient(follow_redirects=False)
        catalog = build_executor_catalog(settings, client)
    else:
        catalog = executor_catalog
    journal = SqliteExecutionJournalAdapter(settings.journal_file)
    execution = ExecutionApplicationService(
        journal=journal,
        executor_catalog=catalog,
        max_concurrency=settings.max_concurrent_tasks,
    )
    async def close_resources() -> None:
        if client is not None:
            await client.aclose()

    return ApplicationComponents(
        settings=settings,
        executor_catalog=catalog,
        execution=execution,
        close_resources=close_resources,
    )


def create_app(
    settings: WorkerSettings, executor_catalog: ExecutorCatalogPort | None = None
) -> FastAPI:
    components = build_application(settings, executor_catalog)
    state = AppState(
        settings=components.settings,
        executor_catalog=components.executor_catalog,
        execution=components.execution,
        close_resources=components.close,
    )
    return create_http_app(state)


__all__ = [
    "ApplicationComponents",
    "build_application",
    "build_executor_catalog",
    "create_app",
]
