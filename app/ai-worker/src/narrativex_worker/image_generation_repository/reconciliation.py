"""Image-item reconciliation and base provider-completion behavior."""

import hashlib
import json
import uuid

from narrativex_worker.image_generation_repository.models import DurableImageOperation
from narrativex_worker.media_repository import DurableMediaResult
from narrativex_worker.providers.image import ImageBatchItem, ImageGenerationRequest
from narrativex_worker.schema import ImageAspectRatio, ImageQualityTier


class ImageReconciliationMixin:
    async def mark_failed(
        self,
        item_key: str,
        request_fingerprint: str,
        error: str,
        *,
        operation: DurableImageOperation | None = None,
    ) -> bool:
        result = await self._require_pool().execute(
            """
            UPDATE media_generation_items
               SET execution_status = 'FAILED', error_code = $3, updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE item_key = $1 AND request_fingerprint = $2
               AND execution_status IN ('RUNNING', 'VALIDATING', 'UNKNOWN')
               AND (
                   ($4::uuid IS NULL AND $5::text IS NULL AND $6::uuid IS NULL)
                   OR EXISTS (
                       SELECT 1
                         FROM provider_operations po
                         JOIN stage_attempts sa ON sa.id = po.stage_attempt_id
                        WHERE po.id = media_generation_items.provider_operation_id
                          AND po.id = $4
                          AND sa.worker_id = $5
                          AND sa.lease_token = $6::uuid
                          AND sa.status = 'RUNNING'
                   )
               )
            """,
            item_key,
            request_fingerprint,
            error[:80],
            operation.id if operation is not None else None,
            operation.worker_id if operation is not None else None,
            operation.lease_token if operation is not None else None,
        )
        return str(result) == "UPDATE 1"

    async def due_operations(self, limit: int) -> tuple[DurableImageOperation, ...]:
        rows = await self._require_pool().fetch(
            """
            SELECT po.id, po.stage_attempt_id, po.provider_key, po.request_fingerprint,
                   po.provider_operation_id, po.status, po.row_version
              FROM provider_operations po
              JOIN stage_attempts sa ON sa.id = po.stage_attempt_id
              JOIN generation_jobs gj ON gj.id = sa.generation_job_id
             WHERE sa.stage_name = 'SHOT_IMAGE_GENERATE'
               AND po.status IN ('UNKNOWN', 'SUBMITTED', 'RUNNING')
               AND po.next_reconcile_at IS NOT NULL
               AND po.next_reconcile_at <= CURRENT_TIMESTAMP
             ORDER BY po.next_reconcile_at NULLS FIRST, po.id
             LIMIT $1
            """,
            limit,
        )
        operations: list[DurableImageOperation] = []
        for row in rows:
            items = await self._items_for_operation(row["id"])
            operations.append(self._operation(row, items))
        return tuple(operations)

    async def complete_provider_operation(
        self, operation: DurableImageOperation, results: tuple[DurableMediaResult, ...]
    ) -> None:
        summary = json.dumps({"items": len(results)}, separators=(",", ":"))
        fingerprint = hashlib.sha256(summary.encode()).hexdigest()
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                await connection.execute(
                    """
                    UPDATE provider_operations
                       SET status = 'COMPLETED', normalized_result_json = $2::jsonb,
                           result_fingerprint = $3,
                           completed_at = CURRENT_TIMESTAMP,
                           next_reconcile_at = NULL, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status IN ('UNKNOWN', 'SUBMITTED', 'RUNNING')
                       AND row_version = $4
                    """,
                    operation.id,
                    summary,
                    fingerprint,
                    operation.row_version,
                )
        await self.aggregate_generation_job(operation.stage_attempt_id)

    async def _items_for_operation(self, operation_id: uuid.UUID) -> tuple[ImageBatchItem, ...]:
        rows = await self._require_pool().fetch(
            """
            SELECT mgi.item_key, mgi.request_fingerprint,
                   COALESCE(mbp.prompt_snapshot, mbp.visual_intent) AS prompt,
                   mbp.negative_prompt, mp.image_aspect_ratio, mp.image_quality_tier,
                   mp.image_model_key, mp.image_provider_key
              FROM media_generation_items mgi
              JOIN media_plans mp ON mp.id = mgi.media_plan_id
              JOIN media_beat_plans mbp ON mbp.media_plan_id = mgi.media_plan_id
                                            AND mbp.visual_beat_id = mgi.visual_beat_id
             WHERE mgi.provider_operation_id = $1 ORDER BY mgi.item_key
            """,
            operation_id,
        )
        return tuple(
            ImageBatchItem(
                row["item_key"],
                ImageGenerationRequest(
                    request_fingerprint=row["request_fingerprint"],
                    prompt=row["prompt"] or "",
                    negative_prompt=row["negative_prompt"],
                    aspect_ratio=ImageAspectRatio(row["image_aspect_ratio"] or "16:9"),
                    quality_tier=ImageQualityTier(row["image_quality_tier"] or "STANDARD"),
                    provider_key=row["image_provider_key"] or "vertex",
                    model_key=row["image_model_key"] or self.settings.vertex_image_model,
                    location=self.settings.vertex_image_batch_location,
                    max_output_bytes=self.settings.image_max_output_bytes,
                ),
            )
            for row in rows
        )
