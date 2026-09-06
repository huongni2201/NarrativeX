"""Stable facade for the chapter-analysis worker repository."""

import uuid
from contextvars import ContextVar
from dataclasses import replace

from narrativex_worker.repository.analysis_checkpoints import AnalysisCheckpointRepository
from narrativex_worker.repository.implementation import (
    ALLOWED_PROVIDER_TRANSITIONS,
    ClaimedChapterAnalysisJob,
    DurableProviderOperation,
    ProviderOperationInvalidTransitionError,
    ProviderOperationStateConflictError,
    ProviderResultConflictError,
    provider_request_fingerprint,
)
from narrativex_worker.repository.implementation import (
    WorkerRepository as WorkerRepositoryImplementation,
)
from narrativex_worker.schema import ChapterAnalysisResult
from narrativex_worker.visual_density import (
    ChapterAnalysisPlanningRequest,
    bind_planning_duration,
)


class WorkerRepository(WorkerRepositoryImplementation):
    """Public repository facade with task-local per-claim ownership fencing."""

    def __init__(self, database_url: str, lease_seconds: int, pool_size: int = 5) -> None:
        super().__init__(database_url, lease_seconds, pool_size)
        self._claim_owner: ContextVar[str | None] = ContextVar(
            f"chapter-analysis-claim-owner-{id(self)}", default=None
        )

    async def claim_next(self, worker_id: str) -> ClaimedChapterAnalysisJob | None:
        claim_owner = self._new_claim_owner(worker_id)
        claimed = await super().claim_next(claim_owner)
        self._claim_owner.set(claim_owner if claimed is not None else None)
        if claimed is None:
            bind_planning_duration(None)
            return None
        return await self._hydrate_analysis_preferences(claimed)

    async def _hydrate_analysis_preferences(
        self, claimed: ClaimedChapterAnalysisJob
    ) -> ClaimedChapterAnalysisJob:
        pool = self._require_pool()
        row = await pool.fetchrow(
            """
            SELECT gj.analysis_visual_generation_mode,
                   gj.analysis_image_provider,
                   (
                       SELECT na.duration_ms
                         FROM narration_requests nr
                         JOIN narration_assets na ON na.narration_request_id = nr.id
                        WHERE nr.chapter_id = gj.chapter_id
                          AND nr.source_hash = gj.source_hash
                        ORDER BY nr.created_at DESC, na.created_at DESC, na.id DESC
                        LIMIT 1
                   ) AS narration_duration_ms
              FROM generation_jobs gj
             WHERE gj.id = $1
            """,
            claimed.generation_job_id,
        )

        visual_generation_mode = (
            row["analysis_visual_generation_mode"]
            if row is not None and row["analysis_visual_generation_mode"] is not None
            else "IMAGE"
        )
        image_provider = (
            row["analysis_image_provider"]
            if row is not None and visual_generation_mode == "IMAGE"
            else None
        )
        if visual_generation_mode == "IMAGE" and image_provider is None:
            image_provider = "API"

        raw_duration = row.get("narration_duration_ms") if row is not None else None
        narration_duration_ms = (
            raw_duration if isinstance(raw_duration, int) and raw_duration > 0 else None
        )
        bind_planning_duration(narration_duration_ms)

        request_payload = claimed.request.model_dump(mode="python")
        request_payload.update(
            {
                "visual_generation_mode": visual_generation_mode,
                "image_provider": image_provider,
                "narration_duration_ms": narration_duration_ms,
            }
        )
        return replace(
            claimed,
            request=ChapterAnalysisPlanningRequest.model_validate(request_payload),
        )

    async def heartbeat(self, stage_attempt_id: uuid.UUID, worker_id: str) -> bool:
        return await super().heartbeat(stage_attempt_id, self._lease_owner(worker_id))

    async def complete(
        self,
        claimed: ClaimedChapterAnalysisJob,
        worker_id: str,
        result: ChapterAnalysisResult,
    ) -> None:
        await super().complete(claimed, self._lease_owner(worker_id), result)
        self._claim_owner.set(None)

    async def fail(
        self,
        claimed: ClaimedChapterAnalysisJob,
        worker_id: str,
        error_code: str,
    ) -> None:
        try:
            await super().fail(claimed, self._lease_owner(worker_id), error_code)
        finally:
            self._claim_owner.set(None)

    async def release_stage_for_provider_replay(
        self, operation: DurableProviderOperation
    ) -> bool:
        """Make a terminal provider result immediately reclaimable by the normal lease path.

        Provider reconciliation persists only provider state. Materialization must still run through
        ``complete()`` under a fresh StageAttempt lease so chapter snapshot checks remain enforced.
        """
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                generation_job_id = await connection.fetchval(
                    """
                    UPDATE stage_attempts
                       SET status = 'STALLED',
                           worker_id = NULL,
                           heartbeat_at = NULL,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status IN ('RUNNING', 'UNKNOWN')
                    RETURNING generation_job_id
                    """,
                    operation.stage_attempt_id,
                )
                if generation_job_id is None:
                    return False

                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'STALLED',
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status IN ('RUNNING', 'UNKNOWN', 'STALLED')
                    """,
                    generation_job_id,
                )
                return True

    def analysis_checkpoints(self) -> AnalysisCheckpointRepository:
        """Return a checkpoint facade backed by this worker's shared connection pool."""
        return AnalysisCheckpointRepository(self._require_pool())

    def current_claim_owner(self, worker_id: str) -> str:
        """Resolve the task-local lease identity written to the current StageAttempt."""
        return self._lease_owner(worker_id)

    def _lease_owner(self, worker_id: str) -> str:
        return self._claim_owner.get() or worker_id

    @staticmethod
    def _new_claim_owner(worker_id: str) -> str:
        prefix = (worker_id or "worker")[:80]
        return f"{prefix}:claim:{uuid.uuid4()}"


__all__ = [
    "ALLOWED_PROVIDER_TRANSITIONS",
    "AnalysisCheckpointRepository",
    "ClaimedChapterAnalysisJob",
    "DurableProviderOperation",
    "ProviderOperationInvalidTransitionError",
    "ProviderOperationStateConflictError",
    "ProviderResultConflictError",
    "WorkerRepository",
    "provider_request_fingerprint",
]
