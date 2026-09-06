"""Per-submit durable execution context for chapter-analysis provider subcalls."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    from narrativex_worker.repository.analysis_checkpoints import AnalysisCheckpointRepository


@dataclass(frozen=True)
class ChapterAnalysisExecutionContext:
    """Lease-fenced state required to persist one durable operation per external subcall."""

    stage_attempt_id: UUID
    claim_owner: str
    checkpoints: AnalysisCheckpointRepository
