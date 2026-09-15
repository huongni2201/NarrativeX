from __future__ import annotations

from typing import Protocol

from narrativex_gpu_worker.contracts import ComputeTask, ExecutorCapability

from .execution import ExecutorPort


class ExecutorCatalogPort(Protocol):
    """Capability/model selection port owned by executor adapters."""

    def resolve(self, task: ComputeTask) -> ExecutorPort: ...

    def capabilities(self) -> list[ExecutorCapability]: ...
