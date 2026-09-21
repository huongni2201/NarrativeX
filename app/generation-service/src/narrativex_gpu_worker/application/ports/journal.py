from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from narrativex_gpu_worker.application.models.outbox import PendingOutboxEvent
from narrativex_gpu_worker.contracts import ComputeObservation, ComputeTask
from narrativex_gpu_worker.domain import SubmissionState


class ExecutionJournalPort(Protocol):
    """Durable local replay/recovery port for execution attempts."""

    async def initialize(self) -> None: ...

    async def save_accepted(self, task: ComputeTask) -> tuple[ComputeObservation, bool]: ...

    async def load(self, task_id: UUID, attempt_id: UUID) -> ComputeObservation | None: ...

    async def replay(self, task: ComputeTask) -> ComputeObservation | None: ...

    async def load_task(self, task_id: UUID, attempt_id: UUID) -> ComputeTask | None: ...

    async def update(self, observation: ComputeObservation) -> None: ...

    async def request_cancel(self, task_id: UUID, attempt_id: UUID) -> bool: ...

    async def is_cancel_requested(self, task_id: UUID, attempt_id: UUID) -> bool: ...

    async def save_execution_handle(
        self, task_id: UUID, attempt_id: UUID, execution_handle: str
    ) -> None: ...

    async def mark_submitting(self, task_id: UUID, attempt_id: UUID) -> None: ...

    async def mark_submitted(
        self, task_id: UUID, attempt_id: UUID, execution_handle: str
    ) -> None: ...

    async def mark_unknown(self, task_id: UUID, attempt_id: UUID) -> None: ...

    async def load_submission_state(
        self, task_id: UUID, attempt_id: UUID
    ) -> SubmissionState | None: ...

    async def recoverable(self) -> list[tuple[ComputeTask, bool, str | None, SubmissionState]]: ...


class OutboxJournalPort(Protocol):
    """Durable journal port for compute event outbox storage."""

    async def fetch_pending_outbox_events(
        self, *, limit: int = 50, due_before: datetime | None = None
    ) -> list[PendingOutboxEvent]: ...

    async def mark_outbox_event_delivered(
        self, event_id: str, delivered_at: datetime | None = None
    ) -> None: ...

    async def record_outbox_delivery_failure(
        self, event_id: str, next_attempt_at: datetime
    ) -> None: ...
