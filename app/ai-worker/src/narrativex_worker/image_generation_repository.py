"""PostgreSQL repository for the durable SHOT_IMAGE_GENERATE worker.

This repository intentionally owns claim/lease and provider-operation writes. The image provider
never receives a call until the UNKNOWN submission fence and its item bindings have committed.
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


class ImageGenerationLeaseLostError(RuntimeError):
    """Raised when a worker no longer owns the image-generation stage lease."""


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
    worker_id: str | None = None
    lease_token: str | None = None


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

    async def assert_lease(self, job: ClaimedImageGenerationJob) -> None:
        row = await self._require_pool().fetchrow(
            """
            SELECT 1
              FROM stage_attempts
             WHERE id = $1 AND worker_id = $2 AND lease_token = $3::uuid AND status = 'RUNNING'
            """,
            job.stage_attempt_id,
            job.worker_id,
            job.lease_token,
        )
        if row is None:
            raise ImageGenerationLeaseLostError()

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
    ) -> None:
        pool = self._require_pool()
        error = error_code[:2000]
        async with pool.acquire() as connection:
            async with connection.transaction():
                await connection.execute(
                    """
                    UPDATE provider_operations
                       SET status = 'FAILED',
                           last_reconcile_error = $2,
                           completed_at = CURRENT_TIMESTAMP,
                           next_reconcile_at = NULL,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                    """,
                    operation.id,
                    error,
                )
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
        await self.aggregate_generation_job(operation.stage_attempt_id)

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
                   ($4::bigint IS NULL AND $5::text IS NULL AND $6::uuid IS NULL)
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

    async def aggregate_generation_job(self, stage_attempt_id: int) -> None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                await self._aggregate_generation_job(connection, stage_attempt_id)

    async def _aggregate_generation_job(
        self, connection: asyncpg.Connection, stage_attempt_id: int
    ) -> None:
        stage = await connection.fetchrow(
            """
            SELECT sa.generation_job_id
              FROM stage_attempts sa
             WHERE sa.id = $1
             FOR UPDATE
            """,
            stage_attempt_id,
        )
        if stage is None:
            raise ImageGenerationLeaseLostError(
                "Image generation stage disappeared while aggregating job status"
            )

        summary_rows = await connection.fetch(
            """
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE execution_status = 'READY') AS ready,
                   COUNT(*) FILTER (WHERE execution_status = 'FAILED') AS failed,
                   COUNT(*) FILTER (
                       WHERE execution_status IN ('QUEUED', 'RUNNING', 'VALIDATING', 'UNKNOWN')
                   ) AS pending
              FROM media_generation_items
             WHERE generation_job_id = $1
            """,
            stage["generation_job_id"],
        )
        if not summary_rows:
            return
        summary = summary_rows[0]

        total = int(summary["total"] or 0)
        ready = int(summary["ready"] or 0)
        failed = int(summary["failed"] or 0)
        pending = int(summary["pending"] or 0)
        terminal = ready + failed
        progress = int(terminal * 100 / total) if total else 0

        if pending > 0:
            status = "RUNNING"
            current_step = "SHOT_IMAGE_GENERATE_RUNNING"
        elif failed > 0:
            status = "FAILED"
            current_step = "SHOT_IMAGE_GENERATE_FAILED"
        elif ready == total:
            status = "COMPLETED"
            progress = 100
            current_step = "SHOT_IMAGE_GENERATE_COMPLETED"
        else:
            status = "RUNNING"
            current_step = "SHOT_IMAGE_GENERATE_RUNNING"

        await connection.execute(
            """
            UPDATE stage_attempts
               SET status = $2, heartbeat_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
             WHERE id = $1
               AND status IN ('QUEUED', 'RUNNING', 'STALLED', 'UNKNOWN', 'COMPLETED')
            """,
            stage_attempt_id,
            status,
        )
        await connection.execute(
            """
            UPDATE generation_jobs
               SET status = $2, progress = $3, current_step = $4,
                   updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
             WHERE id = $1
               AND status IN ('QUEUED', 'RUNNING', 'STALLED', 'UNKNOWN', 'COMPLETED')
            """,
            stage["generation_job_id"],
            status,
            progress,
            current_step,
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
    def _operation(
        row: Any,
        items: tuple[ImageBatchItem, ...],
        *,
        owner: DurableImageOperation | None = None,
    ) -> DurableImageOperation:
        return DurableImageOperation(
            id=row["id"],
            stage_attempt_id=row["stage_attempt_id"],
            provider_key=row["provider_key"],
            request_fingerprint=row["request_fingerprint"],
            provider_operation_id=row["provider_operation_id"],
            status=ProviderOperationStatus(row["status"]),
            row_version=row["row_version"],
            items=items,
            worker_id=owner.worker_id if owner is not None else None,
            lease_token=owner.lease_token if owner is not None else None,
        )
