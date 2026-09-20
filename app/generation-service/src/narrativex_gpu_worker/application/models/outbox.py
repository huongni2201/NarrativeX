from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class PendingOutboxEvent:
    event_id: str
    task_id: UUID
    attempt_id: UUID
    sequence: int
    payload_json: str
    attempt_count: int
    next_attempt_at: datetime
    created_at: datetime
