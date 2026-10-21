"""Composition root for the generation service.

Only this module knows which concrete adapters are used in a deployment. The
application service and inbound adapters receive ports instead of constructing
SQLite, HTTP or provider implementations themselves.
"""

from __future__ import annotations

import os
import shlex
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx
from fastapi import FastAPI

from narrativex_gpu_worker.adapters.artifacts import HttpArtifactAdapter
from narrativex_gpu_worker.adapters.events import HttpComputeEventPublisher
from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.executors.comfyui import ComfyUIClient, ComfyUIExecutor
from narrativex_gpu_worker.adapters.executors.ltx import LtxVideoExecutor
from narrativex_gpu_worker.adapters.executors.ltx.profiles import resolve_profile
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
    RuntimeRequirement,
    RuntimeResidencyPort,
)
from narrativex_gpu_worker.application.services import ExecutionApplicationService
from narrativex_gpu_worker.application.services.outbox_delivery_service import (
    OutboxDeliveryService,
)
from narrativex_gpu_worker.config import WorkerSettings


@dataclass(frozen=True, slots=True)
class ApplicationComponents:
    settings: WorkerSettings
    executor_catalog: ExecutorCatalogPort
    execution: ExecutionApplicationService
    outbox: OutboxDeliveryService | None = None
    residency: RuntimeResidencyPort | None = None
    close_resources: Callable[[], Awaitable[None]] | None = None
    prepare_resources: Callable[[], Awaitable[None]] | None = None

    async def close(self) -> None:
        if self.close_resources is not None:
            await self.close_resources()


def split_command(command: str, windows: bool | None = None) -> tuple[str, ...]:
    """Split a runtime command line; Windows paths keep their backslashes."""
    if not (os.name == "nt" if windows is None else windows):
        return tuple(shlex.split(command))
    parts = shlex.split(command, posix=False)
    return tuple(
        part[1:-1] if len(part) >= 2 and part[0] == part[-1] and part[0] in "\"'" else part
        for part in parts
    )


def gpu_total_vram_reader(settings: WorkerSettings) -> Callable[[], Awaitable[int | None]]:
    """Declared VRAM wins; otherwise nvidia-smi, and None when the size is unknown."""
    probe = GpuVramProbe(enabled=settings.residency_vram_probe_enabled)

    async def read() -> int | None:
        if settings.gpu_vram_mb is not None:
            return settings.gpu_vram_mb
        usage = await probe.query_vram()
        return usage.total_mb if usage is not None else None

    return read


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
            LtxVideoExecutor(
                ComfyUIClient(
                    base_url=settings.comfyui_base_url,
                    timeout=settings.comfyui_timeout_seconds,
                    client=client,
                ),
                artifacts,
                # Readiness stays false until pinned runtime/model/schema preflight succeeds.
                runtime_directory=settings.ltx_runtime_directory,
                max_artifact_bytes=settings.max_artifact_bytes,
                profile=resolve_profile(settings.ltx_profile),
                gpu_total_vram_mb=gpu_total_vram_reader(settings),
                vram_budget_mb=settings.ltx_vram_budget_mb,
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
            comfy_cmd = split_command(settings.comfyui_command)
            comfy_health = f"{settings.comfyui_base_url.rstrip('/')}/system_stats"
            supervisor.register_runtime(
                ProcessSpec(
                    family=RuntimeFamily.COMFYUI_IMAGE,
                    command=comfy_cmd,
                    health_url=comfy_health,
                    startup_timeout_seconds=settings.residency_transition_timeout_seconds,
                )
            )
            supervisor.register_runtime(
                ProcessSpec(
                    family=RuntimeFamily.LTX_VIDEO,
                    command=comfy_cmd,
                    health_url=comfy_health,
                    startup_timeout_seconds=settings.residency_transition_timeout_seconds,
                )
            )
        if settings.vieneu_command.strip():
            supervisor.register_runtime(
                ProcessSpec(
                    family=RuntimeFamily.VIENEU,
                    command=split_command(settings.vieneu_command),
                    health_url=f"{settings.vieneu_base_url.rstrip('/')}/health",
                    startup_timeout_seconds=settings.residency_transition_timeout_seconds,
                )
            )
        if settings.whisperx_command.strip():
            supervisor.register_runtime(
                ProcessSpec(
                    family=RuntimeFamily.WHISPERX,
                    command=split_command(settings.whisperx_command),
                    startup_timeout_seconds=settings.residency_transition_timeout_seconds,
                )
            )
        managed_families = (
            RuntimeFamily.VIENEU,
            RuntimeFamily.COMFYUI_IMAGE,
            RuntimeFamily.WHISPERX,
            RuntimeFamily.LTX_VIDEO,
        )

        def unload_hook(family: RuntimeFamily) -> Callable[[], Awaitable[None]]:
            async def unload() -> None:
                release = getattr(catalog, "unload_runtime", None)
                if release is not None:
                    await release(family)
                assert supervisor is not None
                await supervisor.stop(family)

            return unload

        residency_manager = GpuResidencyManager(
            transition_timeout_seconds=settings.residency_transition_timeout_seconds,
            unload_hooks={f: unload_hook(f) for f in managed_families},
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

    secret = (
        settings.callback_shared_secret.get_secret_value()
        or settings.machine_token.get_secret_value()
    )
    publisher = HttpComputeEventPublisher(
        callback_url=settings.backend_callback_url,
        shared_secret=secret,
        http_client=client,
    )
    outbox = (
        OutboxDeliveryService(journal=journal, publisher=publisher)
        if settings.event_delivery_enabled
        else None
    )

    async def close_resources() -> None:
        try:
            if outbox is not None:
                await outbox.stop()
        finally:
            try:
                await residency_manager.release_all()
            finally:
                try:
                    if supervisor is not None:
                        await supervisor.stop_all()
                finally:
                    if client is not None:
                        await client.aclose()

    async def prepare_resources() -> None:
        preflight = getattr(catalog, "preflight", None)
        if preflight is None:
            return
        if (
            supervisor is not None
            and settings.comfyui_command.strip()
            and settings.ltx_runtime_directory
        ):
            # Residency tracks the booted dependency so a later family switch unloads it.
            async with residency_manager.acquire(
                RuntimeRequirement(family=RuntimeFamily.LTX_VIDEO)
            ):
                await preflight()
        else:
            await preflight()

    return ApplicationComponents(
        settings=settings,
        executor_catalog=catalog,
        execution=execution,
        outbox=outbox,
        residency=residency_manager,
        close_resources=close_resources,
        prepare_resources=prepare_resources,
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
        outbox=components.outbox,
        close_resources=components.close,
        prepare_resources=components.prepare_resources,
    )
    return create_http_app(state)


__all__ = [
    "ApplicationComponents",
    "build_application",
    "build_executor_catalog",
    "create_app",
]
