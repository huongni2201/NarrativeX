"""Framework-free domain core with lazy legacy exports."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .execution_attempt import AttemptState, ExecutionAttempt, InvalidExecutionTransition

if TYPE_CHECKING:
    from .fingerprint import request_fingerprint
    from .models import ComputeObservation, ComputeTask, ExecutionState, WorkerCapabilities


_LEGACY_MODEL_EXPORTS = frozenset(
    {"ComputeObservation", "ComputeTask", "ExecutionState", "WorkerCapabilities"}
)


def __getattr__(name: str) -> object:
    if name in _LEGACY_MODEL_EXPORTS:
        from . import models

        return getattr(models, name)
    if name == "request_fingerprint":
        from .fingerprint import request_fingerprint

        return request_fingerprint
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "AttemptState",
    "ComputeObservation",
    "ComputeTask",
    "ExecutionAttempt",
    "ExecutionState",
    "InvalidExecutionTransition",
    "WorkerCapabilities",
    "request_fingerprint",
]
