"""Stable narration repository facade."""

import uuid
from contextvars import ContextVar

from narrativex_worker.narration.models import AlignmentSpan
from narrativex_worker.narration.repository.completion import NarrationCompletionMixin
from narrativex_worker.narration.repository.implementation import (
    ClaimedNarrationJob,
    DurableNarrationProviderOperation,
    NarrationClaimStateConflictError,
    NarrationProviderStateConflictError,
    segment_request_fingerprint,
)
from narrativex_worker.narration.repository.implementation import (
    NarrationWorkerRepository as NarrationWorkerRepositoryImplementation,
)
from narrativex_worker.narration.storage import StoredMediaAsset


class NarrationWorkerRepository(NarrationCompletionMixin, NarrationWorkerRepositoryImplementation):
    """Public narration repository with task-local per-claim ownership fencing."""

    def __init__(self, database_url: str, lease_seconds: int, *, pool_size: int = 5) -> None:
        super().__init__(database_url, lease_seconds, pool_size=pool_size)
        self._claim_owner: ContextVar[str | None] = ContextVar(
            f"narration-claim-owner-{id(self)}", default=None
        )

    async def claim_next(self, worker_id: str) -> ClaimedNarrationJob | None:
        claim_owner = self._new_claim_owner(worker_id)
        claimed = await super().claim_next(claim_owner)
        self._claim_owner.set(claim_owner if claimed is not None else None)
        return claimed

    async def claim_due_reconciliation(self, worker_id: str) -> ClaimedNarrationJob | None:
        claim_owner = self._new_claim_owner(worker_id)
        claimed = await super().claim_due_reconciliation(claim_owner)
        self._claim_owner.set(claim_owner if claimed is not None else None)
        return claimed

    async def heartbeat(self, stage_attempt_id: uuid.UUID, worker_id: str) -> bool:
        return await super().heartbeat(stage_attempt_id, self._lease_owner(worker_id))

    async def mark_unknown(self, claimed: ClaimedNarrationJob, worker_id: str) -> bool:
        try:
            return await super().mark_unknown(claimed, self._lease_owner(worker_id))
        finally:
            self._claim_owner.set(None)

    async def mark_reconciliation_exhausted(
        self, claimed: ClaimedNarrationJob, worker_id: str, error_code: str
    ) -> bool:
        try:
            return await super().mark_reconciliation_exhausted(
                claimed, self._lease_owner(worker_id), error_code
            )
        finally:
            self._claim_owner.set(None)

    async def mark_stalled(
        self, claimed: ClaimedNarrationJob, worker_id: str, error_code: str
    ) -> bool:
        try:
            return await super().mark_stalled(
                claimed, self._lease_owner(worker_id), error_code
            )
        finally:
            self._claim_owner.set(None)

    async def fail(self, claimed: ClaimedNarrationJob, worker_id: str, error_code: str) -> None:
        try:
            await super().fail(claimed, self._lease_owner(worker_id), error_code)
        finally:
            self._claim_owner.set(None)

    async def complete(
        self,
        claimed: ClaimedNarrationJob,
        worker_id: str,
        media_asset: StoredMediaAsset,
        *,
        duration_ms: int,
        sample_rate_hz: int,
        channels: int,
        spans: list[AlignmentSpan],
    ) -> None:
        await super().complete(
            claimed,
            self._lease_owner(worker_id),
            media_asset,
            duration_ms=duration_ms,
            sample_rate_hz=sample_rate_hz,
            channels=channels,
            spans=spans,
        )
        self._claim_owner.set(None)

    def _lease_owner(self, worker_id: str) -> str:
        return self._claim_owner.get() or worker_id

    @staticmethod
    def _new_claim_owner(worker_id: str) -> str:
        prefix = (worker_id or "worker")[:80]
        return f"{prefix}:claim:{uuid.uuid4()}"


__all__ = [
    "ClaimedNarrationJob",
    "DurableNarrationProviderOperation",
    "NarrationClaimStateConflictError",
    "NarrationProviderStateConflictError",
    "NarrationWorkerRepository",
    "segment_request_fingerprint",
]
