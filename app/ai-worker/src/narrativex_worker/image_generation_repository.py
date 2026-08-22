"""PostgreSQL repository for the durable SHOT_IMAGE_GENERATE worker.

This repository intentionally owns claim/lease and provider-operation writes. The image provider
never receives a call until the RESERVED operation and its item bindings have committed.
"""

import hashlib
import json
import uuid
from dataclasses import dataclass
from typing import Any

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.config import WorkerSettings
from narrativex_worker.media_repository import DurableMediaResult
from narrativex_worker.providers.image import (
    ImageBatchItem,
    ImageGenerationRequest,
    ImageGenerationResult,
)
from narrativex_worker.providers.image import (
    batch_fingerprint as provider_batch_fingerprint,
)
from narrativex_worker.schema import ImageAspectRatio, ImageQualityTier, ProviderOperationStatus


@dataclass(frozen=True)
class ClaimedImageGenerationJob:
    generation_job_id: int
    stage_attempt_id: int
    lease_token: str
    project_id: int
    media_plan_id: uuid.UUID
    worker_id: str


@dataclass(frozen=True)
class ClaimedImageGenerationItem:
    id: uuid.UUID
    item_key: str
    visual_beat_id: int
    request: ImageGenerationRequest


@dataclass(frozen=True)
class DurableImageOperation:
    id: int
    stage_attempt_id: int
    provider_key: str
    request_fingerprint: str
    provider_operation_id: str | None
    status: ProviderOperationStatus
    row_version: int
    items: tuple[ImageBatchItem, ...]
    created: bool = False


class ImageGenerationRepository:
    def __init__(self, database_url: str, lease_seconds: int, settings: WorkerSettings) -> None:
        self.database_url = database_url
        self.lease_seconds = lease_seconds
        self.settings = settings
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                self.database_url,
                min_size=1,
                max_size=max(5, self.settings.worker_concurrency * 2 + 1),
            )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def claim_next(self, worker_id: str) -> ClaimedImageGenerationJob | None:
        pool = self._require_pool()
        token = str(uuid.uuid4())
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT sa.id AS stage_attempt_id, sa.generation_job_id,
                           gj.project_id, gj.media_plan_id
                      FROM stage_attempts sa
                      JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                     WHERE sa.stage_name = 'SHOT_IMAGE_GENERATE'
                       AND gj.status IN ('QUEUED', 'RUNNING', 'STALLED')
                       AND (
                           sa.status IN ('QUEUED', 'STALLED')
                           OR (sa.status = 'RUNNING' AND (sa.heartbeat_at IS NULL OR
                               sa.heartbeat_at < CURRENT_TIMESTAMP -
                               ($1 * INTERVAL '1 second')))
                       )
                     ORDER BY sa.created_at, sa.id
                     FOR UPDATE OF sa SKIP LOCKED
                     LIMIT 1
                    """,
                    self.lease_seconds,
                )
                if row is None:
                    return None
                await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'RUNNING', worker_id = $1, lease_token = $2::uuid,
                           heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $3
                    """,
                    worker_id,
                    token,
                    row["stage_attempt_id"],
                )
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'RUNNING', progress = GREATEST(progress, 5),
                           current_step = 'SHOT_IMAGE_GENERATE', updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status <> 'COMPLETED'
                    """,
                    row["generation_job_id"],
                )
                return ClaimedImageGenerationJob(
                    generation_job_id=row["generation_job_id"],
                    stage_attempt_id=row["stage_attempt_id"],
                    lease_token=token,
                    project_id=row["project_id"],
                    media_plan_id=row["media_plan_id"],
                    worker_id=worker_id,
                )

    async def heartbeat(self, job: ClaimedImageGenerationJob) -> bool:
        result = await self._require_pool().execute(
            """
            UPDATE stage_attempts
               SET heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND worker_id = $2 AND lease_token = $3::uuid AND status = 'RUNNING'
            """,
            job.stage_attempt_id,
            job.worker_id,
            job.lease_token,
        )
        return str(result) == "UPDATE 1"

    async def load_pending_items(
        self, job: ClaimedImageGenerationJob
    ) -> tuple[ClaimedImageGenerationItem, ...]:
        rows = await self._require_pool().fetch(
            """
            SELECT mgi.id, mgi.item_key, mgi.visual_beat_id, mgi.request_fingerprint,
                   COALESCE(mbp.prompt_snapshot, mbp.visual_intent) AS prompt,
                   mbp.negative_prompt, mp.image_aspect_ratio, mp.image_quality_tier,
                   mp.image_model_key, mp.image_provider_key
              FROM media_generation_items mgi
              JOIN media_plans mp ON mp.id = mgi.media_plan_id
              JOIN media_beat_plans mbp
                ON mbp.media_plan_id = mgi.media_plan_id AND mbp.visual_beat_id = mgi.visual_beat_id
             WHERE mgi.generation_job_id = $1 AND mgi.execution_status = 'QUEUED'
             ORDER BY mgi.item_key
            """,
            job.generation_job_id,
        )
        items: list[ClaimedImageGenerationItem] = []
        for row in rows:
            aspect = ImageAspectRatio(row["image_aspect_ratio"] or "16:9")
            quality = ImageQualityTier(row["image_quality_tier"] or "STANDARD")
            items.append(
                ClaimedImageGenerationItem(
                    id=row["id"],
                    item_key=row["item_key"],
                    visual_beat_id=row["visual_beat_id"],
                    request=ImageGenerationRequest(
                        request_fingerprint=row["request_fingerprint"],
                        prompt=row["prompt"] or "",
                        negative_prompt=row["negative_prompt"],
                        aspect_ratio=aspect,
                        quality_tier=quality,
                        provider_key=row["image_provider_key"] or "vertex",
                        model_key=row["image_model_key"] or self.settings.vertex_image_model,
                        location=self.settings.vertex_image_batch_location,
                        max_output_bytes=self.settings.image_max_output_bytes,
                    ),
                )
            )
        return tuple(items)

    async def reserve_provider_operation(
        self, job: ClaimedImageGenerationJob, items: tuple[ImageBatchItem, ...]
    ) -> DurableImageOperation:
        fingerprint = provider_batch_fingerprint(items)
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    INSERT INTO provider_operations
                        (stage_attempt_id, provider_key, request_fingerprint, status)
                    VALUES ($1, $2, $3, 'RESERVED')
                    ON CONFLICT (provider_key, request_fingerprint) DO NOTHING
                    RETURNING id, stage_attempt_id, provider_key, request_fingerprint,
                              provider_operation_id,
                              status, row_version
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
                               provider_operation_id,
                               status, row_version
                          FROM provider_operations
                         WHERE provider_key = $1 AND request_fingerprint = $2
                         FOR UPDATE
                        """,
                        items[0].request.provider_key,
                        fingerprint,
                    )
                if row is None:
                    raise RuntimeError("Image provider operation reservation disappeared")
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
                )

    async def bind_items_to_operation(
        self, job: ClaimedImageGenerationJob, operation: DurableImageOperation
    ) -> None:
        ids = [
            row["id"]
            for row in await self._require_pool().fetch(
                """
                SELECT id
                  FROM media_generation_items
                 WHERE generation_job_id = $1 AND item_key = ANY($2::text[])
                """,
                job.generation_job_id,
                [item.item_key for item in operation.items],
            )
        ]
        if len(ids) != len(operation.items):
            raise RuntimeError("Image generation item set changed while claiming")
        result = await self._require_pool().execute(
            """
            UPDATE media_generation_items
               SET provider_operation_id = $1, execution_status = 'RUNNING',
                   updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
             WHERE generation_job_id = $2 AND item_key = ANY($3::text[])
               AND execution_status = 'QUEUED'
            """,
            operation.id,
            job.generation_job_id,
            [item.item_key for item in operation.items],
        )
        if str(result) != f"UPDATE {len(operation.items)}":
            raise RuntimeError("Image generation items were claimed by another worker")

    async def mark_submitted(
        self,
        operation: DurableImageOperation,
        provider_operation_id: str | None,
        status: ProviderOperationStatus,
    ) -> DurableImageOperation:
        safe_status = (
            status
            if status in {ProviderOperationStatus.SUBMITTED, ProviderOperationStatus.RUNNING}
            else ProviderOperationStatus.UNKNOWN
        )
        row = await self._require_pool().fetchrow(
            """
            UPDATE provider_operations
               SET status = $2, provider_operation_id = COALESCE($3, provider_operation_id),
                   next_reconcile_at = CURRENT_TIMESTAMP + INTERVAL '15 seconds',
                   updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
             WHERE id = $1 AND status IN ('RESERVED', 'UNKNOWN') AND row_version = $4
              RETURNING id, stage_attempt_id, provider_key, request_fingerprint,
                        provider_operation_id,
                        status, row_version
            """,
            operation.id,
            safe_status.value,
            provider_operation_id,
            operation.row_version,
        )
        if row is None:
            raise RuntimeError("Image provider operation changed before submission was persisted")
        return self._operation(row, operation.items)

    async def mark_submission_unknown(
        self, operation: DurableImageOperation
    ) -> DurableImageOperation:
        row = await self._require_pool().fetchrow(
            """
            UPDATE provider_operations
               SET status = 'UNKNOWN', next_reconcile_at = CURRENT_TIMESTAMP,
                   last_reconcile_error = NULL, updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = $1 AND status = 'RESERVED' AND row_version = $2
              RETURNING id, stage_attempt_id, provider_key, request_fingerprint,
                        provider_operation_id,
                        status, row_version
            """,
            operation.id,
            operation.row_version,
        )
        if row is None:
            raise RuntimeError("Image provider operation changed before submission fence")
        return self._operation(row, operation.items)

    async def mark_unknown(self, operation: DurableImageOperation, error: str) -> None:
        await self._require_pool().execute(
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
            """,
            operation.id,
            error[:2000],
            operation.row_version,
            self.settings.vertex_image_unknown_max_age_seconds,
        )

    async def mark_failed(self, item_key: str, request_fingerprint: str, error: str) -> None:
        await self._require_pool().execute(
            """
            UPDATE media_generation_items
               SET execution_status = 'FAILED', error_code = $3, updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE item_key = $1 AND request_fingerprint = $2
               AND execution_status IN ('RUNNING', 'VALIDATING', 'UNKNOWN')
            """,
            item_key,
            request_fingerprint,
            error[:80],
        )

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

    async def complete_batch(
        self, operation: DurableImageOperation, results: tuple[DurableMediaResult, ...]
    ) -> None:
        del results
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                rows = await connection.fetch(
                    """
                    SELECT execution_status
                      FROM media_generation_items
                     WHERE provider_operation_id = $1
                     FOR UPDATE
                    """,
                    operation.id,
                )
                if not rows or any(
                    row["execution_status"] not in {"READY", "FAILED"} for row in rows
                ):
                    return
                summary = json.dumps({"items": len(rows)}, separators=(",", ":"))
                fingerprint = hashlib.sha256(summary.encode()).hexdigest()
                await connection.execute(
                    """
                    UPDATE provider_operations
                       SET status = 'COMPLETED', normalized_result_json = $2::jsonb,
                           result_fingerprint = $3,
                           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
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
                stage = await connection.fetchrow(
                    "SELECT generation_job_id FROM stage_attempts WHERE id = $1 FOR UPDATE",
                    operation.stage_attempt_id,
                )
                failed = any(row["execution_status"] == "FAILED" for row in rows)
                if stage is not None:
                    await connection.execute(
                        """
                        UPDATE stage_attempts
                           SET status = 'COMPLETED', heartbeat_at = CURRENT_TIMESTAMP,
                               updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                         WHERE id = $1 AND status IN ('RUNNING', 'STALLED', 'UNKNOWN')
                        """,
                        operation.stage_attempt_id,
                    )
                    await connection.execute(
                        """
                        UPDATE generation_jobs
                           SET status = $2, progress = 100, current_step = $3,
                               updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                         WHERE id = $1 AND status IN ('QUEUED', 'RUNNING', 'STALLED', 'UNKNOWN')
                        """,
                        stage["generation_job_id"],
                        "FAILED" if failed else "COMPLETED",
                        "SHOT_IMAGE_GENERATE_FAILED" if failed else "SHOT_IMAGE_GENERATE_COMPLETED",
                    )

    async def finalize_image_result(
        self,
        *,
        operation_id: int | None,
        item_key: str,
        request_fingerprint: str,
        provider_operation_id: str | None,
        provider_result: ImageGenerationResult,
        stored: DurableMediaResult,
    ) -> DurableMediaResult:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT mgi.id, mgi.execution_status, mgi.media_asset_id,
                           mgi.request_fingerprint,
                           mgi.visual_beat_id, mgi.generation_job_id, mgi.media_plan_id,
                           gj.project_id, gj.requested_by_user_id, mp.chapter_id
                      FROM media_generation_items mgi
                      JOIN generation_jobs gj ON gj.id = mgi.generation_job_id
                      JOIN media_plans mp ON mp.id = mgi.media_plan_id
                     WHERE ($1::bigint IS NULL OR mgi.provider_operation_id = $1)
                       AND mgi.item_key = $2 AND mgi.request_fingerprint = $3
                     FOR UPDATE
                    """,
                    operation_id,
                    item_key,
                    request_fingerprint,
                )
                if row is None:
                    raise RuntimeError("IMAGE_GENERATION_ITEM_NOT_FOUND")
                if row["execution_status"] == "READY":
                    existing = await connection.fetchrow(
                        "SELECT sha256 FROM media_assets WHERE id = $1", row["media_asset_id"]
                    )
                    if existing and existing["sha256"] == stored.checksum:
                        return stored
                    raise RuntimeError("IMAGE_MATERIALIZATION_CONFLICT")
                asset = await connection.fetchrow(
                    """
                    SELECT media_asset_id
                      FROM media_asset_checksums
                     WHERE account_id = $1 AND sha256 = $2
                    """,
                    row["requested_by_user_id"],
                    stored.checksum,
                )
                asset_id = asset["media_asset_id"] if asset else uuid.uuid4()
                if asset is None:
                    await connection.execute(
                        """
                        INSERT INTO media_assets
                            (id, account_id, asset_type, origin, storage_key, original_filename,
                             content_type, size_bytes, sha256, status, width, height,
                             checksum_verified_at)
                        VALUES ($1, $2, 'IMAGE', 'IMAGE_GENERATED', $3, $4, $5, $6, $7,
                                'READY', $8, $9, CURRENT_TIMESTAMP)
                        """,
                        asset_id,
                        row["requested_by_user_id"],
                        stored.storage_key,
                        f"{item_key}.png",
                        stored.mime_type,
                        len(provider_result.content),
                        stored.checksum,
                        stored.width,
                        stored.height,
                    )
                    await connection.execute(
                        """
                        INSERT INTO media_asset_checksums (account_id, sha256, media_asset_id)
                        VALUES ($1, $2, $3)
                        """,
                        row["requested_by_user_id"],
                        stored.checksum,
                        asset_id,
                    )
                await connection.execute(
                    """
                    INSERT INTO media_asset_lineage
                        (id, media_asset_id, account_id, project_id, chapter_id, visual_beat_id,
                         generation_job_id, media_plan_id, generation_item_id, relation_type,
                         request_fingerprint, result_fingerprint, prompt_snapshot,
                         provider_snapshot_json)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'GENERATED_KEYFRAME',
                            $10, $11, NULL, $12::jsonb)
                    ON CONFLICT (generation_item_id, relation_type) DO NOTHING
                    """,
                    uuid.uuid4(),
                    asset_id,
                    row["requested_by_user_id"],
                    row["project_id"],
                    row["chapter_id"],
                    row["visual_beat_id"],
                    row["generation_job_id"],
                    row["media_plan_id"],
                    row["id"],
                    request_fingerprint,
                    stored.checksum,
                    json.dumps(
                        {"providerOperationId": provider_operation_id}, separators=(",", ":")
                    ),
                )
                await connection.execute(
                    """
                    UPDATE media_generation_items
                       SET execution_status = 'READY', review_status = 'NEEDS_REVIEW',
                           media_asset_id = $2, error_code = NULL,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1
                    """,
                    row["id"],
                    asset_id,
                )
                return stored

    async def _items_for_operation(self, operation_id: int) -> tuple[ImageBatchItem, ...]:
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

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("ImageGenerationRepository is not connected")
        return self._pool

    @staticmethod
    def _operation(row: Any, items: tuple[ImageBatchItem, ...]) -> DurableImageOperation:
        return DurableImageOperation(
            id=row["id"],
            stage_attempt_id=row["stage_attempt_id"],
            provider_key=row["provider_key"],
            request_fingerprint=row["request_fingerprint"],
            provider_operation_id=row["provider_operation_id"],
            status=ProviderOperationStatus(row["status"]),
            row_version=row["row_version"],
            items=items,
        )
