"""Aggregate image-item state into stage-attempt and generation-job state."""

import uuid

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.image_generation_repository.core import ImageRepositoryMixin
from narrativex_worker.image_generation_repository.models import ImageGenerationLeaseLostError


class ImageAggregationMixin(ImageRepositoryMixin):
    async def aggregate_generation_job(self, stage_attempt_id: uuid.UUID) -> None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                await self._aggregate_generation_job(connection, stage_attempt_id)

    async def _aggregate_generation_job(
        self, connection: asyncpg.Connection, stage_attempt_id: uuid.UUID
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
