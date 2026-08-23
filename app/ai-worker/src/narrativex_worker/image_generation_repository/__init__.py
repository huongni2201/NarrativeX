"""Stable image-generation repository facade."""

from narrativex_worker.image_generation_repository.implementation import (
    ClaimedImageGenerationItem,
    ClaimedImageGenerationJob,
    DurableImageOperation,
    ImageGenerationLeaseLostError,
)
from narrativex_worker.image_generation_repository.implementation import (
    ImageGenerationRepository as ImageGenerationRepositoryImplementation,
)


class ImageGenerationRepository(ImageGenerationRepositoryImplementation):
    """Public facade retained for existing worker and test consumers.

    The implementation keeps ambiguous paid submissions recoverable as UNKNOWN. Once that
    recovery window expires, the facade terminalizes the operation and its bound media items in
    one transaction so the stage/job cannot remain RUNNING forever.
    """

    async def mark_unknown(self, operation: DurableImageOperation, error: str) -> bool:
        pool = self._require_pool()
        terminalized = False
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    UPDATE provider_operations
                       SET status = CASE
                               WHEN reserved_at <= CURRENT_TIMESTAMP - ($4 * INTERVAL '1 second')
                               THEN 'FAILED'
                               ELSE 'UNKNOWN'
                           END,
                           completed_at = CASE
                               WHEN reserved_at <= CURRENT_TIMESTAMP - ($4 * INTERVAL '1 second')
                               THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
                               ELSE completed_at
                           END,
                           next_reconcile_at = CASE
                               WHEN reserved_at <= CURRENT_TIMESTAMP - ($4 * INTERVAL '1 second')
                               THEN NULL
                               ELSE CURRENT_TIMESTAMP + INTERVAL '15 seconds'
                           END,
                           last_reconcile_error = CASE
                               WHEN reserved_at <= CURRENT_TIMESTAMP - ($4 * INTERVAL '1 second')
                               THEN 'PROVIDER_SUBMISSION_UNRESOLVED'
                               ELSE $2
                           END,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status IN ('RESERVED', 'SUBMITTED', 'RUNNING', 'UNKNOWN')
                       AND row_version = $3
                       AND (
                           ($5::text IS NULL AND $6::uuid IS NULL)
                           OR EXISTS (
                               SELECT 1
                                 FROM stage_attempts sa
                                WHERE sa.id = provider_operations.stage_attempt_id
                                  AND sa.worker_id = $5
                                  AND sa.lease_token = $6::uuid
                                  AND sa.status = 'RUNNING'
                           )
                       )
                    RETURNING status
                    """,
                    operation.id,
                    error[:2000],
                    operation.row_version,
                    self.settings.vertex_image_unknown_max_age_seconds,
                    operation.worker_id,
                    operation.lease_token,
                )
                if row is None:
                    return False

                terminalized = row["status"] == "FAILED"
                if terminalized:
                    await connection.execute(
                        """
                        UPDATE media_generation_items
                           SET execution_status = 'FAILED',
                               error_code = 'PROVIDER_SUBMISSION_UNRESOLVED',
                               updated_at = CURRENT_TIMESTAMP,
                               row_version = row_version + 1
                         WHERE provider_operation_id = $1
                           AND execution_status NOT IN ('READY', 'FAILED')
                        """,
                        operation.id,
                    )

        if terminalized:
            await self.aggregate_generation_job(operation.stage_attempt_id)
        return True


__all__ = [
    "ClaimedImageGenerationItem",
    "ClaimedImageGenerationJob",
    "DurableImageOperation",
    "ImageGenerationLeaseLostError",
    "ImageGenerationRepository",
]
