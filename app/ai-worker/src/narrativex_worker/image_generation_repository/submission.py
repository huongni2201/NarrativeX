"""Durable provider-submission fencing and base provider-state transitions."""

from narrativex_worker.image_generation_repository.core import ImageRepositoryMixin
from narrativex_worker.image_generation_repository.models import (
    ClaimedImageGenerationJob,
    DurableImageOperation,
    ImageGenerationLeaseLostError,
)
from narrativex_worker.providers.image import ImageBatchItem
from narrativex_worker.providers.image import batch_fingerprint as provider_batch_fingerprint
from narrativex_worker.schema import ProviderOperationStatus


class ImageSubmissionMixin(ImageRepositoryMixin):
    async def prepare_provider_submission(
        self, job: ClaimedImageGenerationJob, items: tuple[ImageBatchItem, ...]
    ) -> DurableImageOperation:
        if not items:
            raise ValueError("IMAGE_GENERATION_ITEMS_REQUIRED")

        fingerprint = provider_batch_fingerprint(items)
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                lease = await connection.fetchrow(
                    """
                    SELECT id
                      FROM stage_attempts
                     WHERE id = $1
                       AND worker_id = $2
                       AND lease_token = $3::uuid
                       AND status = 'RUNNING'
                     FOR UPDATE
                    """,
                    job.stage_attempt_id,
                    job.worker_id,
                    job.lease_token,
                )
                if lease is None:
                    raise ImageGenerationLeaseLostError()

                row = await connection.fetchrow(
                    """
                    INSERT INTO provider_operations
                        (stage_attempt_id, provider_key, request_fingerprint, status,
                         next_reconcile_at)
                    VALUES ($1, $2, $3, 'UNKNOWN', CURRENT_TIMESTAMP)
                    ON CONFLICT (provider_key, request_fingerprint) DO NOTHING
                    RETURNING id, stage_attempt_id, provider_key, request_fingerprint,
                              provider_operation_id, status, row_version
                    """,
                    job.stage_attempt_id,
                    items[0].request.provider_key,
                    fingerprint,
                )
                created = row is not None
                if row is None:
                    row = await connection.fetchrow(
                        """
                        SELECT id, stage_attempt_id, provider_key, request_fingerprint,
                               provider_operation_id, status, row_version
                          FROM provider_operations
                         WHERE provider_key = $1 AND request_fingerprint = $2
                         FOR UPDATE
                        """,
                        items[0].request.provider_key,
                        fingerprint,
                    )
                if row is None:
                    raise RuntimeError("Image provider operation disappeared")

                if not created and row["status"] in {"RESERVED", "UNKNOWN"}:
                    row = await connection.fetchrow(
                        """
                        UPDATE provider_operations
                           SET status = 'UNKNOWN', next_reconcile_at = CURRENT_TIMESTAMP,
                               last_reconcile_error = NULL, updated_at = CURRENT_TIMESTAMP,
                               row_version = row_version + 1
                         WHERE id = $1 AND status IN ('RESERVED', 'UNKNOWN')
                        RETURNING id, stage_attempt_id, provider_key, request_fingerprint,
                                  provider_operation_id, status, row_version
                        """,
                        row["id"],
                    )
                    if row is None:
                        raise RuntimeError(
                            "Image provider operation changed before submission fence"
                        )

                result = await connection.execute(
                    """
                    UPDATE media_generation_items
                       SET provider_operation_id = $1, execution_status = 'RUNNING',
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE generation_job_id = $2 AND item_key = ANY($3::text[])
                       AND execution_status = 'QUEUED'
                    """,
                    row["id"],
                    job.generation_job_id,
                    [item.item_key for item in items],
                )
                updated_count = int(str(result).rsplit(" ", 1)[-1])
                if updated_count != len(items):
                    raise RuntimeError("IMAGE_GENERATION_ITEMS_ALREADY_CLAIMED")

                return DurableImageOperation(
                    id=row["id"],
                    stage_attempt_id=row["stage_attempt_id"],
                    provider_key=row["provider_key"],
                    request_fingerprint=row["request_fingerprint"],
                    provider_operation_id=row["provider_operation_id"],
                    status=ProviderOperationStatus(row["status"]),
                    row_version=row["row_version"],
                    items=items,
                    created=created,
                    worker_id=job.worker_id,
                    lease_token=job.lease_token,
                )

    async def mark_submitted(
        self,
        operation: DurableImageOperation,
        provider_operation_id: str | None,
        status: ProviderOperationStatus,
    ) -> DurableImageOperation:
        if status not in {
            ProviderOperationStatus.SUBMITTED,
            ProviderOperationStatus.RUNNING,
        }:
            raise ValueError(f"invalid submitted status: {status}")
        row = await self._require_pool().fetchrow(
            """
            UPDATE provider_operations
               SET status = $2, provider_operation_id = COALESCE($3, provider_operation_id),
                   next_reconcile_at = CURRENT_TIMESTAMP + INTERVAL '15 seconds',
                   updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
             WHERE id = $1 AND status IN ('RESERVED', 'UNKNOWN') AND row_version = $4
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
              RETURNING id, stage_attempt_id, provider_key, request_fingerprint,
                        provider_operation_id,
                        status, row_version
            """,
            operation.id,
            status.value,
            provider_operation_id,
            operation.row_version,
            operation.worker_id,
            operation.lease_token,
        )
        if row is None:
            raise ImageGenerationLeaseLostError(
                "Image provider operation changed or lease was lost before submission was persisted"
            )
        return self._operation(row, operation.items, owner=operation)

    async def fail_provider_operation(
        self, operation: DurableImageOperation, error_code: str
    ) -> bool:
        pool = self._require_pool()
        error = error_code[:2000]
        transitioned = False
        async with pool.acquire() as connection:
            async with connection.transaction():
                result = await connection.execute(
                    """
                    UPDATE provider_operations
                       SET status = 'FAILED',
                           last_reconcile_error = $2,
                           completed_at = CURRENT_TIMESTAMP,
                           next_reconcile_at = NULL,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status IN ('RESERVED', 'UNKNOWN', 'SUBMITTED', 'RUNNING')
                       AND row_version = $3
                       AND (
                           ($4::text IS NULL AND $5::uuid IS NULL)
                           OR EXISTS (
                               SELECT 1
                                 FROM stage_attempts sa
                                WHERE sa.id = provider_operations.stage_attempt_id
                                  AND sa.worker_id = $4
                                  AND sa.lease_token = $5::uuid
                                  AND sa.status = 'RUNNING'
                           )
                       )
                    """,
                    operation.id,
                    error,
                    operation.row_version,
                    operation.worker_id,
                    operation.lease_token,
                )
                transitioned = str(result) == "UPDATE 1"
                if transitioned:
                    await connection.execute(
                        """
                        UPDATE media_generation_items
                           SET execution_status = 'FAILED',
                               error_code = $2,
                               updated_at = CURRENT_TIMESTAMP,
                               row_version = row_version + 1
                         WHERE provider_operation_id = $1
                           AND execution_status NOT IN ('READY', 'FAILED')
                        """,
                        operation.id,
                        error[:80],
                    )
        if transitioned:
            await self.aggregate_generation_job(operation.stage_attempt_id)
        return transitioned

    async def mark_unknown(self, operation: DurableImageOperation, error: str) -> bool:
        result = await self._require_pool().execute(
            """
            UPDATE provider_operations
               SET status = 'UNKNOWN',
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
             WHERE id = $1 AND status IN ('RESERVED', 'SUBMITTED', 'RUNNING', 'UNKNOWN')
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
            """,
            operation.id,
            error[:2000],
            operation.row_version,
            self.settings.vertex_image_unknown_max_age_seconds,
            operation.worker_id,
            operation.lease_token,
        )
        return str(result) == "UPDATE 1"
