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
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT sa.id AS stage_attempt_id,
                           sa.status AS stage_attempt_status,
                           sa.row_version AS stage_attempt_row_version,
                           gj.id AS generation_job_id,
                           gj.status AS generation_job_status,
                           gj.row_version AS generation_job_row_version,
                           gj.job_id,
                           nr.id AS narration_request_id,
                           nr.project_id,
                           nr.chapter_id,
                           nr.chapter_row_version,
                           nr.source_hash,
                           nr.source_text,
                           nr.voice_id,
                           nr.language,
                           nr.speaking_rate,
                           nr.request_fingerprint,
                           COALESCE(
                               vra.storage_key,
                               NULLIF(vc.metadata_json ->> 'referenceStorageKey', '')
                           ) AS voice_reference_storage_key
                      FROM stage_attempts sa
                      JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                      JOIN narration_operations no ON no.stage_attempt_id = sa.id
                      JOIN narration_requests nr ON nr.id = no.narration_request_id
                      LEFT JOIN voice_reference_assets vra
                        ON vra.id = nr.voice_reference_asset_id
                       AND vra.status = 'READY'
                      LEFT JOIN voice_catalog vc ON vc.id = nr.voice_id
                     WHERE gj.job_type = 'NARRATION_GENERATE'
                       AND gj.status IN ('QUEUED', 'RUNNING', 'STALLED')
                       AND sa.stage_name = 'NARRATION_TTS'
                       AND (
                           sa.status IN ('QUEUED', 'STALLED')
                           OR (
                               sa.status = 'RUNNING'
                               AND (
                                   sa.heartbeat_at IS NULL
                                   OR sa.heartbeat_at
                                      < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second')
                               )
                           )
                       )
                     ORDER BY sa.created_at, sa.id
                     FOR UPDATE OF sa SKIP LOCKED
                     LIMIT 1
                    """,
                    self.lease_seconds,
                )
                if row is None:
                    self._claim_owner.set(None)
                    return None
                claimed = await self._claim_candidate(
                    connection,
                    row,
                    claim_owner,
                    current_step="NARRATION_TTS",
                )
        self._claim_owner.set(claim_owner if claimed is not None else None)
        return claimed

    async def claim_due_reconciliation(self, worker_id: str) -> ClaimedNarrationJob | None:
        claim_owner = self._new_claim_owner(worker_id)
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT sa.id AS stage_attempt_id,
                           sa.status AS stage_attempt_status,
                           sa.row_version AS stage_attempt_row_version,
                           gj.id AS generation_job_id,
                           gj.status AS generation_job_status,
                           gj.row_version AS generation_job_row_version,
                           gj.job_id,
                           nr.id AS narration_request_id,
                           nr.project_id,
                           nr.chapter_id,
                           nr.chapter_row_version,
                           nr.source_hash,
                           nr.source_text,
                           nr.voice_id,
                           nr.language,
                           nr.speaking_rate,
                           nr.request_fingerprint,
                           COALESCE(
                               vra.storage_key,
                               NULLIF(vc.metadata_json ->> 'referenceStorageKey', '')
                           ) AS voice_reference_storage_key
                      FROM provider_operations po
                      JOIN stage_attempts sa ON sa.id = po.stage_attempt_id
                      JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                      JOIN narration_operations no ON no.stage_attempt_id = sa.id
                      JOIN narration_requests nr ON nr.id = no.narration_request_id
                      LEFT JOIN voice_reference_assets vra
                        ON vra.id = nr.voice_reference_asset_id
                       AND vra.status = 'READY'
                      LEFT JOIN voice_catalog vc ON vc.id = nr.voice_id
                     WHERE po.status = 'UNKNOWN'
                       AND po.next_reconcile_at IS NOT NULL
                       AND po.next_reconcile_at <= CURRENT_TIMESTAMP
                       AND gj.job_type = 'NARRATION_GENERATE'
                       AND gj.status = 'UNKNOWN'
                       AND sa.stage_name = 'NARRATION_TTS'
                       AND sa.status = 'UNKNOWN'
                     ORDER BY po.next_reconcile_at, po.id
                     FOR UPDATE OF sa SKIP LOCKED
                     LIMIT 1
                    """
                )
                if row is None:
                    self._claim_owner.set(None)
                    return None
                claimed = await self._claim_candidate(
                    connection,
                    row,
                    claim_owner,
                    current_step="NARRATION_TTS_RECONCILE",
                )
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
