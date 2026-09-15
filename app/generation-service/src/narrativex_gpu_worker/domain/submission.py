"""Domain submission checkpoints for external engine dispatch."""

from __future__ import annotations

from enum import Enum


class SubmissionState(str, Enum):
    """Internal lifecycle checkpoint for tracking external engine interactions.

    These states are internal execution checkpoints, separate from external wire
    Compute Protocol ExecutionState.
    """

    NOT_SUBMITTED = "NOT_SUBMITTED"
    SUBMITTING = "SUBMITTING"
    SUBMITTED = "SUBMITTED"
    UNKNOWN = "UNKNOWN"

    @property
    def can_dispatch(self) -> bool:
        """True if external submission has not yet occurred and may proceed."""
        return self is SubmissionState.NOT_SUBMITTED

    @property
    def can_resume(self) -> bool:
        """True if an acknowledged handle exists to resume polling."""
        return self is SubmissionState.SUBMITTED

    @property
    def is_ambiguous(self) -> bool:
        """True if the external outcome is unconfirmed; blind resubmission forbidden."""
        return self in {SubmissionState.SUBMITTING, SubmissionState.UNKNOWN}


__all__ = ["SubmissionState"]
