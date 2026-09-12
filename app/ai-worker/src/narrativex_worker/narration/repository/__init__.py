"""Stable narration repository facade."""

import hashlib
import json
import uuid
from contextvars import ContextVar
from dataclasses import replace

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
from narrativex_worker.schema import ProviderOperationStatus


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
        if isinstance(claimed, ClaimedNarrationJob):
            claimed = await self._attach_system_voice_reference(claimed)
        self._claim_owner.set(claim_owner if claimed is not None else None)
        return claimed

    async def claim_due_reconciliation(self, worker_id: str) -> ClaimedNarrationJob | None:
        claim_owner = self._new_claim_owner(worker_id)
        claimed = await super().claim_due_reconciliation(claim_owner)
        if isinstance(claimed, ClaimedNarrationJob):
            claimed = await self._attach_system_voice_reference(claimed)
        self._claim_owner.set(claim_owner if claimed is not None else None)
        return claimed

    async def _attach_system_voice_reference(
        self, claimed: ClaimedNarrationJob
    ) -> ClaimedNarrationJob:
        """Attach a catalog-owned R2 key only when the request has no custom reference.

        PROJECT references stay device-local and ACCOUNT references retain their own R2
        object metadata. A catalog reference is therefore a fallback for system voices,
        never a replacement for an explicitly selected custom voice.
        """
        if (
            claimed.voice_reference_scope is not None
            or claimed.voice_reference_storage_key is not None
        ):
            return claimed

        storage_key = await self._require_pool().fetchval(
            """
            SELECT NULLIF(metadata_json ->> 'referenceStorageKey', '')
              FROM voice_catalog
             WHERE id = $1
               AND enabled = TRUE
            """,
            claimed.voice_id,
        )
        if storage_key is None:
            return claimed
        return replace(claimed, voice_reference_storage_key=str(storage_key))

    async def complete_provider_operation(
        self,
        operation: DurableNarrationProviderOperation,
        result: dict[str, object],
        *,
        character_count: int,
        pricing: object,
    ) -> DurableNarrationProviderOperation:
        """Persist only durable provider result state; billing metadata is intentionally ignored."""
        del character_count, pricing
        serialized = json.dumps(result, sort_keys=True, separators=(",", ":"))
        fingerprint = hashlib.sha256(serialized.encode()).hexdigest()
        row = await self._require_pool().fetchrow(
            """
            UPDATE provider_operations
               SET status = 'COMPLETED', normalized_result_json = $2::jsonb,
                   result_fingerprint = $3,
                   completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
                   next_reconcile_at = NULL, last_reconcile_error = NULL,
                   updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
             WHERE id = $1 AND status = 'UNKNOWN' AND row_version = $4
             RETURNING id, stage_attempt_id, provider_key, status, row_version,
                       request_fingerprint, normalized_result_json, result_fingerprint,
                       next_reconcile_at, reconcile_attempts, last_reconcile_error
            """,
            operation.id,
            serialized,
            fingerprint,
            operation.row_version,
        )
        if row is not None:
            return self._operation(row)
        current = await self.get_provider_operation(operation.id)
        if (
            current.status is ProviderOperationStatus.COMPLETED
            and current.result_fingerprint == fingerprint
        ):
            return current
        raise NarrationProviderStateConflictError(str(operation.id))

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
        self,
        claimed: ClaimedNarrationJob,
        worker_id: str,
        error_code: str,
    ) -> bool:
        try:
            return await super().mark_stalled(
                claimed,
                self._lease_owner(worker_id),
                error_code,
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
