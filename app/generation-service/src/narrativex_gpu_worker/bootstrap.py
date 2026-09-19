"""Composition root for the generation service.

Only this module knows which concrete adapters are used in a deployment. The
application service and inbound adapters receive ports instead of constructing
SQLite, HTTP or provider implementations themselves.
"""

from __future__ import annotations

import shlex
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx
from fastapi import FastAPI

from narrativex_gpu_worker.adapters.artifacts import HttpArtifactAdapter
from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.executors.comfyui import ComfyUIClient, ComfyUIExecutor
from narrativex_gpu_worker.adapters.executors.media_validation import MediaValidationExecutor
from narrativex_gpu_worker.adapters.executors.vieneu import VieNeuClient, VieNeuExecutor
from narrativex_gpu_worker.adapters.executors.whisperx import WhisperXClient, WhisperXExecutor
from narrativex_gpu_worker.adapters.inbound.http import AppState
from narrativex_gpu_worker.adapters.inbound.http import create_app as create_http_app
from narrativex_gpu_worker.adapters.persistence import SqliteExecutionJournalAdapter
from narrativex_gpu_worker.adapters.runtime import (
    GpuResidencyManager,
    GpuVramProbe,
    ProcessSpec,
    RuntimeProcessSupervisor,
)
from narrativex_gpu_worker.application.ports.executors import ExecutorCatalogPort
from narrativex_gpu_worker.application.ports.residency import (
    NullRuntimeResidency,
    RuntimeFamily,
    RuntimeResidencyPort,
)
from narrativex_gpu_worker.application.services import ExecutionApplicationService
from narrativex_gpu_worker.config import WorkerSettings


@dataclass(frozen=True, slots=True)
class ApplicationComponents:
    settings: WorkerSettings
    executor_catalog: ExecutorCatalogPort
    execution: ExecutionApplicationService
    residency: RuntimeResidencyPort | None = None
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
            ComfyUIExecutor(
                ComfyUIClient(
                    base_url=settings.comfyui_base_url,
                    timeout=settings.comfyui_timeout_seconds,
                    client=client,
                ),
                artifacts,
                ready=bool(settings.comfyui_base_url.strip()),
            ),
            VieNeuExecutor(
                VieNeuClient(
                    base_url=settings.vieneu_base_url,
                    api_key=settings.vieneu_api_key.get_secret_value() or None,
                    timeout=settings.vieneu_timeout_seconds,
                    client=client,
                ),
                artifacts,
                ready=bool(settings.vieneu_base_url.strip()),
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
    settings: WorkerSettings,
    executor_catalog: ExecutorCatalogPort | None = None,
    residency: RuntimeResidencyPort | None = None,
) -> ApplicationComponents:
    client: httpx.AsyncClient | None = None
    if executor_catalog is None:
        client = httpx.AsyncClient(follow_redirects=False)
        catalog = build_executor_catalog(settings, client)
    else:
        catalog = executor_catalog

    residency_manager: RuntimeResidencyPort
    supervisor: RuntimeProcessSupervisor | None = None
    if residency is not None:
        residency_manager = residency
    elif settings.residency_enabled:
        vram_probe = GpuVramProbe(
            max_idle_mb=settings.residency_max_vram_idle_mb,
            enabled=settings.residency_vram_probe_enabled,
        )
        supervisor = RuntimeProcessSupervisor(vram_probe=vram_probe, http_client=client)
        if settings.comfyui_command.strip():
            supervisor.register_runtime(
                ProcessSpec(
                    family=RuntimeFamily.COMFYUI_IMAGE,
                    command=tuple(shlex.split(settings.comfyui_command)),
                    health_url=f"{settings.comfyui_base_url.rstrip('/')}/system_stats",
                    startup_timeout_seconds=settings.residency_transition_timeout_seconds,
                )
            )
        if settings.vieneu_command.strip():
            supervisor.register_runtime(
                ProcessSpec(
                    family=RuntimeFamily.VIENEU,
                    command=tuple(shlex.split(settings.vieneu_command)),
                    health_url=f"{settings.vieneu_base_url.rstrip('/')}/health",
                    startup_timeout_seconds=settings.residency_transition_timeout_seconds,
                )
            )
        if settings.whisperx_command.strip():
            supervisor.register_runtime(
                ProcessSpec(
                    family=RuntimeFamily.WHISPERX,
                    command=tuple(shlex.split(settings.whisperx_command)),
                    startup_timeout_seconds=settings.residency_transition_timeout_seconds,
                )
            )
        managed_families = (
            RuntimeFamily.VIENEU,
            RuntimeFamily.COMFYUI_IMAGE,
            RuntimeFamily.WHISPERX,
        )
        residency_manager = GpuResidencyManager(
            transition_timeout_seconds=settings.residency_transition_timeout_seconds,
            unload_hooks={f: supervisor.create_unload_hook(f) for f in managed_families},
            load_hooks={f: supervisor.create_load_hook(f) for f in managed_families},
            vram_reclamation_probe=vram_probe.check_reclaimed,
        )
    else:
        residency_manager = NullRuntimeResidency()

    journal = SqliteExecutionJournalAdapter(settings.journal_file)
    execution = ExecutionApplicationService(
        journal=journal,
        executor_catalog=catalog,
        max_concurrency=settings.max_concurrent_tasks,
        residency=residency_manager,
    )

    async def close_resources() -> None:
        if client is not None:
            await client.aclose()
        if supervisor is not None:
            await supervisor.stop_all()
        await residency_manager.release_all()

    return ApplicationComponents(
        settings=settings,
        executor_catalog=catalog,
        execution=execution,
        residency=residency_manager,
        close_resources=close_resources,
    )


def create_app(
    settings: WorkerSettings,
    executor_catalog: ExecutorCatalogPort | None = None,
    residency: RuntimeResidencyPort | None = None,
) -> FastAPI:
    components = build_application(settings, executor_catalog, residency=residency)
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
