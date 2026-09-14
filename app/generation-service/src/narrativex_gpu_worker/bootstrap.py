"""Composition root for the generation service.

Only this module knows which concrete adapters are used in a deployment. The
application service and inbound adapters receive ports instead of constructing
SQLite, HTTP or provider implementations themselves.
"""

from __future__ import annotations

from dataclasses import dataclass

from narrativex_gpu_worker.adapters.executors import ExecutorRegistry
from narrativex_gpu_worker.adapters.persistence import SqliteExecutionJournalAdapter
from narrativex_gpu_worker.application.ports.outbound import ExecutorCatalogPort
from narrativex_gpu_worker.application.services import ExecutionApplicationService
from narrativex_gpu_worker.config import WorkerSettings


@dataclass(frozen=True, slots=True)
class ApplicationComponents:
    settings: WorkerSettings
    executor_catalog: ExecutorCatalogPort
    execution: ExecutionApplicationService

    @property
    def registry(self) -> ExecutorCatalogPort:
        """Compatibility alias for callers that still call it a registry."""
        return self.executor_catalog


def build_application(
    settings: WorkerSettings, registry: ExecutorCatalogPort | None = None
) -> ApplicationComponents:
    catalog = registry or ExecutorRegistry()
    journal = SqliteExecutionJournalAdapter(settings.journal_file)
    execution = ExecutionApplicationService(
        journal=journal,
        executor_catalog=catalog,
        max_concurrency=settings.max_concurrent_tasks,
    )
    return ApplicationComponents(settings=settings, executor_catalog=catalog, execution=execution)
