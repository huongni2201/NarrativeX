from __future__ import annotations

from typing import Protocol
from uuid import UUID

from narrativex_gpu_worker.contracts import (
    ArtifactRef,
    ComputeObservation,
    ComputeTask,
    ExecutorCapability,
)

from .execution import ExecutorPort


class ExecutionJournalPort(Protocol):
    """Durable local replay/recovery port for execution attempts."""

    async def initialize(self) -> None: ...

    async def save_accepted(self, task: ComputeTask) -> tuple[ComputeObservation, bool]: ...

    async def load(self, task_id: UUID, attempt_id: UUID) -> ComputeObservation | None: ...

    async def replay(self, task: ComputeTask) -> ComputeObservation | None: ...

    async def load_task(self, task_id: UUID, attempt_id: UUID) -> ComputeTask | None: ...

    async def update(self, observation: ComputeObservation) -> None: ...

    async def recoverable(self) -> list[ComputeTask]: ...


class ExecutorCatalogPort(Protocol):
    """Capability/model selection port owned by executor adapters."""

    def resolve(self, task: ComputeTask) -> ExecutorPort: ...

    def capabilities(self) -> list[ExecutorCapability]: ...


class ArtifactPort(Protocol):
    """Capability-based byte transport used by executor adapters."""

    async def download(self, reference: ArtifactRef) -> bytes: ...

    async def upload(self, reference: ArtifactRef, content: bytes) -> None: ...
