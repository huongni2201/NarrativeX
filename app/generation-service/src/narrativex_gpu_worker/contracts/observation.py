"""Compute Protocol v1 observation, error, capability, and limit schemas."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import Field, model_validator

from .artifact import ProducedArtifact, ProtocolModel
from .task import ModelRef, ProtocolVersion


class ExecutionState(StrEnum):
    ACCEPTED = "ACCEPTED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"


class ErrorCategory(StrEnum):
    PERMANENT = "PERMANENT"
    TRANSIENT = "TRANSIENT"
    CAPACITY = "CAPACITY"
    CANCELED = "CANCELED"


class ComputeError(ProtocolModel):
    code: Annotated[str, Field(pattern=r"^[A-Z][A-Z0-9_]{0,63}$")]
    category: ErrorCategory
    message: Annotated[str, Field(min_length=1, max_length=500)]
    retry_after_seconds: Annotated[int, Field(ge=0, le=86400)] | None = None
    details: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class ExecutionMetrics(ProtocolModel):
    runtime_ms: Annotated[int, Field(ge=0)] | None = None
    gpu_time_ms: Annotated[int, Field(ge=0)] | None = None
    peak_vram_bytes: Annotated[int, Field(ge=0)] | None = None


class ComputeObservation(ProtocolModel):
    protocol_version: ProtocolVersion = "1.0"
    task_id: UUID
    attempt_id: UUID
    state: ExecutionState
    sequence: Annotated[int, Field(ge=0)]
    observed_at: datetime
    execution_handle: Annotated[str, Field(max_length=512)] | None = None
    progress: Annotated[float, Field(ge=0, le=1)] | None = None
    outputs: Annotated[list[ProducedArtifact], Field(max_length=32)] = Field(default_factory=list)
    metrics: ExecutionMetrics = Field(default_factory=ExecutionMetrics)
    error: ComputeError | None = None

    @model_validator(mode="after")
    def terminal_error_is_consistent(self) -> ComputeObservation:
        if self.state == ExecutionState.FAILED and self.error is None:
            raise ValueError("FAILED observation requires error")
        if self.state == ExecutionState.SUCCEEDED and self.error is not None:
            raise ValueError("SUCCEEDED observation cannot contain error")
        return self


class ExecutorCapability(ProtocolModel):
    name: str
    task_types: list[str]
    models: list[ModelRef]
    ready: bool


class WorkerLimits(ProtocolModel):
    max_concurrent_tasks: Annotated[int, Field(ge=1)]
    max_request_bytes: Annotated[int, Field(ge=1)]
    max_artifact_bytes: Annotated[int, Field(ge=1)]


class WorkerCapabilities(ProtocolModel):
    protocol_versions: list[ProtocolVersion]
    worker_version: str
    executors: list[ExecutorCapability]
    limits: WorkerLimits


__all__ = [
    "ComputeError",
    "ComputeObservation",
    "ErrorCategory",
    "ExecutionMetrics",
    "ExecutionState",
    "ExecutorCapability",
    "WorkerCapabilities",
    "WorkerLimits",
]
