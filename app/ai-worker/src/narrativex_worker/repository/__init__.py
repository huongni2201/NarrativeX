"""Stable facade for the chapter-analysis worker repository."""

import uuid
from contextvars import ContextVar

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


class WorkerRepository(WorkerRepositoryImplementation):
    """Public repository facade with task-local per-claim ownership fencing."""

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self._claim_owner: ContextVar[str | None] = ContextVar(
            f"chapter-analysis-claim-owner-{id(self)}", default=None
        )

    async def claim_next(self, worker_id: str) -> ClaimedChapterAnalysisJob | None:
        claim_owner = self._new_claim_owner(worker_id)
        claimed = await super().claim_next(claim_owner)
        self._claim_owner.set(claim_owner if claimed is not None else None)
        return claimed

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

    def _lease_owner(self, worker_id: str) -> str:
        return self._claim_owner.get() or worker_id

    @staticmethod
    def _new_claim_owner(worker_id: str) -> str:
        prefix = (worker_id or "worker")[:80]
        return f"{prefix}:claim:{uuid.uuid4()}"


__all__ = [
    "ALLOWED_PROVIDER_TRANSITIONS",
    "ClaimedChapterAnalysisJob",
    "DurableProviderOperation",
    "ProviderOperationInvalidTransitionError",
    "ProviderOperationStateConflictError",
    "ProviderResultConflictError",
    "WorkerRepository",
    "provider_request_fingerprint",
]
