"""Composition root for the generation service.

Only this module knows which concrete adapters are used in a deployment. The
application service and inbound adapters receive ports instead of constructing
SQLite, HTTP or provider implementations themselves.
"""

from __future__ import annotations

from dataclasses import dataclass
from fastapi import FastAPI

from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.inbound.http import AppState, create_app as create_http_app
from narrativex_gpu_worker.adapters.persistence import SqliteExecutionJournalAdapter
from narrativex_gpu_worker.application.ports.executors import ExecutorCatalogPort
from narrativex_gpu_worker.application.services import ExecutionApplicationService
from narrativex_gpu_worker.config import WorkerSettings


@dataclass(frozen=True, slots=True)
class ApplicationComponents:
    settings: WorkerSettings
    executor_catalog: ExecutorCatalogPort
    execution: ExecutionApplicationService


def build_application(
    settings: WorkerSettings, executor_catalog: ExecutorCatalogPort | None = None
) -> ApplicationComponents:
    catalog = executor_catalog or ExecutorCatalog()
    journal = SqliteExecutionJournalAdapter(settings.journal_file)
    execution = ExecutionApplicationService(
        journal=journal,
        executor_catalog=catalog,
        max_concurrency=settings.max_concurrent_tasks,
    )
    return ApplicationComponents(settings=settings, executor_catalog=catalog, execution=execution)


def create_app(
    settings: WorkerSettings, executor_catalog: ExecutorCatalogPort | None = None
) -> FastAPI:
    components = build_application(settings, executor_catalog)
    state = AppState(
        settings=components.settings,
        executor_catalog=components.executor_catalog,
        execution=components.execution,
    )
    return create_http_app(state)


__all__ = ["ApplicationComponents", "build_application", "create_app"]
