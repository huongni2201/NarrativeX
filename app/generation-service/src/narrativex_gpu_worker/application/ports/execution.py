from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Protocol

from narrativex_gpu_worker.contracts import (
    ComputeTask,
    ExecutionMetrics,
    ModelRef,
    ProducedArtifact,
)

from .residency import RuntimeRequirement


@dataclass(frozen=True, slots=True)
class ExecutionContext:
    """Runtime context for external execution handles and resume/reconciliation."""

    existing_execution_handle: str | None = None
    save_handle: Callable[[str], Awaitable[None]] | None = None
    save_submitting: Callable[[], Awaitable[None]] | None = None
    correlation_key: str | None = None


@dataclass(frozen=True, slots=True)
class ExecutionOutput:
    """Provider-neutral result returned by one executor adapter."""

    outputs: list[ProducedArtifact] = field(default_factory=list)
    metrics: ExecutionMetrics = field(default_factory=ExecutionMetrics)
    execution_handle: str | None = None


class ExecutorPort(Protocol):
    """Driven port implemented by VieNeu, ComfyUI, WhisperX, or fakes."""

    @property
    def name(self) -> str: ...

    @property
    def task_types(self) -> frozenset[str]: ...

    @property
    def models(self) -> tuple[ModelRef, ...]: ...

    @property
    def ready(self) -> bool: ...

    @property
    def runtime_requirement(self) -> RuntimeRequirement: ...

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput: ...
