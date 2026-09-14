from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Protocol

from narrativex_gpu_worker.contracts import ArtifactRef, ComputeTask, ExecutionMetrics, ModelRef


@dataclass(frozen=True, slots=True)
class ExecutionOutput:
    """Provider-neutral result returned by one executor adapter."""

    outputs: list[ArtifactRef] = field(default_factory=list)
    metrics: ExecutionMetrics = field(default_factory=ExecutionMetrics)
    execution_handle: str | None = None


class ExecutorPort(Protocol):
    """Driven port implemented by VoiceStudio, ComfyUI, WhisperX, or fakes."""

    @property
    def name(self) -> str: ...

    @property
    def task_types(self) -> frozenset[str]: ...

    @property
    def models(self) -> tuple[ModelRef, ...]: ...

    @property
    def ready(self) -> bool: ...

    async def execute(self, task: ComputeTask, cancel: asyncio.Event) -> ExecutionOutput: ...
