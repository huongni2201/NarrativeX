"""Framework-free domain core."""

from __future__ import annotations

from .execution_attempt import AttemptState, ExecutionAttempt, InvalidExecutionTransition
from .submission import SubmissionState

__all__ = [
    "AttemptState",
    "ExecutionAttempt",
    "InvalidExecutionTransition",
    "SubmissionState",
]
