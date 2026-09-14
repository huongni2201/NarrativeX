"""Small domain aggregate for the execution-local attempt lifecycle.

The aggregate knows only lifecycle identity and sequencing. It deliberately has
no provider, runtime, HTTP, persistence or Pydantic dependency.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from enum import StrEnum
from uuid import UUID


class AttemptState(StrEnum):
    ACCEPTED = "ACCEPTED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"


class InvalidExecutionTransition(ValueError):
    """Raised when an observation violates the attempt lifecycle."""


TERMINAL_STATES = frozenset(
    {AttemptState.SUCCEEDED, AttemptState.FAILED, AttemptState.CANCELED}
)


@dataclass(frozen=True, slots=True)
class ExecutionAttempt:
    task_id: UUID
    attempt_id: UUID
    idempotency_key: str
    request_fingerprint: str
    state: AttemptState
    sequence: int

    def __post_init__(self) -> None:
        if not self.idempotency_key:
            raise ValueError("idempotency_key must not be empty")
        if len(self.request_fingerprint) != 64:
            raise ValueError("request_fingerprint must be a SHA-256 hex digest")
        if self.sequence < 0:
            raise ValueError("sequence must not be negative")

    @classmethod
    def accepted(
        cls, task_id: UUID, attempt_id: UUID, idempotency_key: str, request_fingerprint: str
    ) -> ExecutionAttempt:
        return cls(
            task_id=task_id,
            attempt_id=attempt_id,
            idempotency_key=idempotency_key,
            request_fingerprint=request_fingerprint,
            state=AttemptState.ACCEPTED,
            sequence=0,
        )

    def matches_request(
        self, task_id: UUID, attempt_id: UUID, idempotency_key: str, request_fingerprint: str
    ) -> bool:
        return (
            self.task_id == task_id
            and self.attempt_id == attempt_id
            and self.idempotency_key == idempotency_key
            and self.request_fingerprint == request_fingerprint
        )

    def apply(self, state: str, sequence: int) -> tuple[ExecutionAttempt, bool]:
        """Apply a newer observation, or ignore a duplicate/older one."""
        if sequence < 0:
            raise InvalidExecutionTransition("sequence must not be negative")
        if sequence <= self.sequence:
            return self, False
        try:
            next_state = AttemptState(state)
        except ValueError as exc:
            raise InvalidExecutionTransition("unknown execution state") from exc
        if self.state in TERMINAL_STATES and next_state != self.state:
            raise InvalidExecutionTransition("terminal execution attempt cannot change state")
        if self.state == AttemptState.RUNNING and next_state == AttemptState.ACCEPTED:
            raise InvalidExecutionTransition("running execution attempt cannot return to accepted")
        return replace(self, state=next_state, sequence=sequence), True
