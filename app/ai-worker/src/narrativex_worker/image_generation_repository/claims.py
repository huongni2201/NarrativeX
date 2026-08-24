"""Claim, lease, heartbeat, and queued-item loading for image generation."""

import uuid

from narrativex_worker.image_generation_repository.models import (
    ClaimedImageGenerationItem,
    ClaimedImageGenerationJob,
    ImageGenerationLeaseLostError,
)
from narrativex_worker.providers.image import ImageGenerationRequest
from narrativex_worker.schema import ImageAspectRatio, ImageQualityTier


class ImageClaimsMixin:
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
