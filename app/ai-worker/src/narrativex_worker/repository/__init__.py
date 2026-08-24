"""Stable facade for the chapter-analysis worker repository."""

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


class WorkerRepository(WorkerRepositoryImplementation):
    """Public repository facade retained for existing worker consumers."""

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
