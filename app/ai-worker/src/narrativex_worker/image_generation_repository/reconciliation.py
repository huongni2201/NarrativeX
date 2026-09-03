"""Image-item reconciliation and base provider-completion behavior."""

import hashlib
import json
import uuid

from narrativex_worker.image_generation_repository.core import ImageRepositoryMixin
from narrativex_worker.image_generation_repository.models import DurableImageOperation
from narrativex_worker.media_repository import DurableMediaResult
from narrativex_worker.providers.image import ImageBatchItem, ImageGenerationRequest
from narrativex_worker.schema import ImageAspectRatio
from narrativex_worker.uuid_v7 import uuid7


class ImageReconciliationMixin(ImageRepositoryMixin):
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

    async def resolve_reused_items(self, stage_attempt_id: uuid.UUID) -> int:
        """Bind reusable beats to their generated anchor without crossing a paid provider boundary."""
        pool = self._require_pool()
        resolved = 0
        async with pool.acquire() as connection:
            async with connection.transaction():
                rows = await connection.fetch(
                    """
                    SELECT target.id AS target_id,
                           target.request_fingerprint,
                           target.visual_beat_id,
                           target.generation_job_id,
                           target.media_plan_id,
                           target_plan.asset_strategy,
                           target_plan.prompt_snapshot,
                           target_plan.reuse_source_visual_beat_id,
                           source.media_asset_id,
                           source.visual_beat_id AS source_visual_beat_id,
                           gj.project_id,
                           gj.requested_by_user_id,
                           mp.chapter_id,
                           ma.sha256
                      FROM stage_attempts sa
                      JOIN media_generation_items target
                        ON target.generation_job_id = sa.generation_job_id
                      JOIN media_beat_plans target_plan
                        ON target_plan.media_plan_id = target.media_plan_id
                       AND target_plan.visual_beat_id = target.visual_beat_id
                      JOIN generation_jobs gj ON gj.id = target.generation_job_id
                      JOIN media_plans mp ON mp.id = target.media_plan_id
                      JOIN LATERAL (
                        SELECT source_item.media_asset_id, source_item.visual_beat_id
                          FROM media_generation_items source_item
                         WHERE source_item.generation_job_id = target.generation_job_id
                           AND source_item.media_plan_id = target.media_plan_id
                           AND source_item.visual_beat_id = target_plan.reuse_source_visual_beat_id
                           AND source_item.execution_status = 'READY'
                           AND source_item.media_asset_id IS NOT NULL
                         ORDER BY source_item.attempt_number DESC,
                                  source_item.created_at DESC,
                                  source_item.id DESC
                         LIMIT 1
                      ) source ON TRUE
                      JOIN media_assets ma ON ma.id = source.media_asset_id
                     WHERE sa.id = $1
                       AND target.execution_status = 'QUEUED'
                       AND target_plan.asset_strategy IN ('REUSE_APPROVED', 'REFRAME_DERIVED')
                       AND target_plan.reuse_source_visual_beat_id IS NOT NULL
                       AND ma.asset_type = 'IMAGE'
                       AND ma.status = 'READY'
                       AND ma.deleted_at IS NULL
                     FOR UPDATE OF target
                    """,
                    stage_attempt_id,
                )
                for row in rows:
                    result = await connection.execute(
                        """
                        UPDATE media_generation_items
                           SET execution_status = 'READY',
                               review_status = 'NEEDS_REVIEW',
                               media_asset_id = $2,
                               error_code = NULL,
                               updated_at = CURRENT_TIMESTAMP,
                               row_version = row_version + 1
                         WHERE id = $1 AND execution_status = 'QUEUED'
                        """,
                        row["target_id"],
                        row["media_asset_id"],
                    )
                    if str(result) != "UPDATE 1":
                        continue
                    await connection.execute(
                        """
                        INSERT INTO media_asset_lineage
                            (id, media_asset_id, account_id, project_id, chapter_id,
                             visual_beat_id, generation_job_id, media_plan_id, generation_item_id,
                             source_asset_id, relation_type, request_fingerprint,
                             result_fingerprint, prompt_snapshot, provider_snapshot_json)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $2,
                                'DERIVED_KEYFRAME', $10, $11, $12, $13::jsonb)
                        ON CONFLICT (generation_item_id, relation_type) DO NOTHING
                        """,
                        uuid7(),
                        row["media_asset_id"],
                        row["requested_by_user_id"],
                        row["project_id"],
                        row["chapter_id"],
                        row["visual_beat_id"],
                        row["generation_job_id"],
                        row["media_plan_id"],
                        row["target_id"],
                        row["request_fingerprint"],
                        row["sha256"],
                        row["prompt_snapshot"],
                        json.dumps(
                            {
                                "assetStrategy": row["asset_strategy"],
                                "sourceVisualBeatId": str(row["source_visual_beat_id"]),
                            },
                            separators=(",", ":"),
                        ),
                    )
                    resolved += 1
        return resolved

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
        await self.resolve_reused_items(operation.stage_attempt_id)
        await self.aggregate_generation_job(operation.stage_attempt_id)

    async def _items_for_operation(self, operation_id: uuid.UUID) -> tuple[ImageBatchItem, ...]:
        rows = await self._require_pool().fetch(
            """
            SELECT mgi.item_key, mgi.request_fingerprint,
                   COALESCE(mbp.prompt_snapshot, mbp.visual_intent) AS prompt,
                   mbp.negative_prompt, mp.image_aspect_ratio,
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
                    provider_key=row["image_provider_key"] or "vertex",
                    model_key=row["image_model_key"] or self.settings.vertex_image_model,
                    location=self.settings.vertex_image_batch_location,
                    max_output_bytes=self.settings.image_max_output_bytes,
                ),
            )
            for row in rows
        )
