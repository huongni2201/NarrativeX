"""Durable repository for long-form project production rendering."""

from dataclasses import dataclass
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.rendering.final_storage import FinalVideoAsset
from narrativex_worker.uuid_v7 import uuid7


class ProjectRenderLeaseLostError(RuntimeError):
    pass


class ProjectRenderStateConflictError(RuntimeError):
    pass


@dataclass(frozen=True)
class ClaimedProjectRenderJob:
    stage_attempt_id: UUID
    generation_job_id: UUID
    job_id: str
    project_id: UUID
    project_owner_id: str
    story_version_id: UUID
    operation_type: str
    aspect_ratio: str
    total_duration_ms: int
    worker_id: str
    lease_token: UUID


@dataclass(frozen=True)
class ProjectRenderChapterAudio:
    chapter_id: UUID
    order_index: int
    global_start_ms: int
    global_end_ms: int
    storage_key: str
    size_bytes: int
    checksum: str
    duration_ms: int


@dataclass(frozen=True)
class ProjectRenderBeatAsset:
    chapter_id: UUID
    scene_index: int
    beat_index: int
    visual_beat_id: UUID
    global_start_ms: int
    global_end_ms: int
    duration_ms: int
    camera_movement: str
    storage_key: str
    size_bytes: int
    checksum: str


class ProjectRenderRepository:
    def __init__(self, database_url: str, lease_seconds: int, *, pool_size: int = 4) -> None:
        self.database_url = database_url
        self.lease_seconds = lease_seconds
        self.pool_size = max(1, pool_size)
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                self.database_url,
                min_size=1,
                max_size=self.pool_size,
            )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def claim_next(self, worker_id: str) -> ClaimedProjectRenderJob | None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT sa.id AS stage_attempt_id,
                           sa.status AS stage_status,
                           sa.row_version AS stage_row_version,
                           gj.id AS generation_job_id,
                           gj.status AS job_status,
                           gj.row_version AS job_row_version,
                           gj.job_id,
                           gj.project_id,
                           p.owner_id AS project_owner_id,
                           pris.story_version_id,
                           pris.aspect_ratio,
                           pris.total_duration_ms,
                           op.operation_type
                      FROM stage_attempts sa
                      JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                      JOIN projects p ON p.id = gj.project_id
                      JOIN project_render_input_snapshots pris
                        ON pris.generation_job_id = gj.id
                      JOIN operation_plans op ON op.generation_job_id = gj.id
                     WHERE gj.job_type = 'RENDER_PROJECT'
                       AND gj.resource_class = 'CPU_RENDER'
                       AND gj.status IN ('QUEUED', 'RUNNING', 'STALLED')
                       AND sa.stage_name = 'RENDER_PROJECT'
                       AND (
                           sa.status IN ('QUEUED', 'STALLED')
                           OR (
                               sa.status = 'RUNNING'
                               AND (
                                   sa.heartbeat_at IS NULL
                                   OR sa.heartbeat_at
                                      < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second')
                               )
                           )
                       )
                     ORDER BY sa.created_at, sa.id
                     FOR UPDATE OF sa SKIP LOCKED
                     LIMIT 1
                    """,
                    self.lease_seconds,
                )
                if row is None:
                    return None

                lease_token = uuid7()
                parent = await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'RUNNING', progress = GREATEST(progress, 5),
                           current_step = 'RENDER_PROJECT', error_code = NULL,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND status = $2 AND row_version = $3
                    """,
                    row["generation_job_id"],
                    row["job_status"],
                    row["job_row_version"],
                )
                if parent != "UPDATE 1":
                    return None

                stage = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'RUNNING', worker_id = $1, lease_token = $2,
                           heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $3 AND status = $4 AND row_version = $5
                    """,
                    worker_id,
                    lease_token,
                    row["stage_attempt_id"],
                    row["stage_status"],
                    row["stage_row_version"],
                )
                if stage != "UPDATE 1":
                    raise ProjectRenderStateConflictError(
                        f"stage_attempt_id={row['stage_attempt_id']} could not be claimed"
                    )

                return ClaimedProjectRenderJob(
                    stage_attempt_id=row["stage_attempt_id"],
                    generation_job_id=row["generation_job_id"],
                    job_id=str(row["job_id"]),
                    project_id=row["project_id"],
                    project_owner_id=str(row["project_owner_id"]),
                    story_version_id=row["story_version_id"],
                    operation_type=str(row["operation_type"]),
                    aspect_ratio=str(row["aspect_ratio"]),
                    total_duration_ms=int(row["total_duration_ms"]),
                    worker_id=worker_id,
                    lease_token=lease_token,
                )

    async def heartbeat(self, claimed: ClaimedProjectRenderJob) -> bool:
        result = await self._require_pool().execute(
            """
            UPDATE stage_attempts
               SET heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND worker_id = $2 AND lease_token = $3 AND status = 'RUNNING'
            """,
            claimed.stage_attempt_id,
            claimed.worker_id,
            claimed.lease_token,
        )
        return str(result) == "UPDATE 1"

    async def assert_lease(self, claimed: ClaimedProjectRenderJob) -> None:
        owned = await self._require_pool().fetchval(
            """
            SELECT EXISTS(
                SELECT 1 FROM stage_attempts
                 WHERE id = $1 AND worker_id = $2 AND lease_token = $3 AND status = 'RUNNING'
            )
            """,
            claimed.stage_attempt_id,
            claimed.worker_id,
            claimed.lease_token,
        )
        if not owned:
            raise ProjectRenderLeaseLostError("Worker no longer owns the project render lease")

    async def update_progress(
        self,
        claimed: ClaimedProjectRenderJob,
        *,
        progress: int,
        current_step: str,
    ) -> None:
        if progress < 5 or progress >= 100:
            raise ValueError("Project render progress must be between 5 and 99")
        step = current_step.strip()
        if not step or len(step) > 80:
            raise ValueError("Project render current_step must contain 1 to 80 characters")
        result = await self._require_pool().execute(
            """
            UPDATE generation_jobs gj
               SET progress = GREATEST(gj.progress, $5),
                   current_step = $6,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = gj.row_version + 1
             WHERE gj.id = $1
               AND gj.status = 'RUNNING'
               AND EXISTS (
                   SELECT 1
                     FROM stage_attempts sa
                    WHERE sa.id = $2
                      AND sa.worker_id = $3
                      AND sa.lease_token = $4
                      AND sa.status = 'RUNNING'
               )
            """,
            claimed.generation_job_id,
            claimed.stage_attempt_id,
            claimed.worker_id,
            claimed.lease_token,
            progress,
            step,
        )
        if str(result) != "UPDATE 1":
            raise ProjectRenderLeaseLostError(
                "Worker lost the project render lease while updating progress"
            )

    async def load_chapters(
        self, claimed: ClaimedProjectRenderJob
    ) -> list[ProjectRenderChapterAudio]:
        rows = await self._require_pool().fetch(
            """
            SELECT chapter_id, chapter_order_index, global_start_ms, global_end_ms,
                   audio_storage_key, audio_size_bytes, audio_checksum, audio_duration_ms
              FROM project_render_input_chapters
             WHERE generation_job_id = $1
             ORDER BY chapter_order_index, chapter_id
            """,
            claimed.generation_job_id,
        )
        return [
            ProjectRenderChapterAudio(
                chapter_id=row["chapter_id"],
                order_index=int(row["chapter_order_index"]),
                global_start_ms=int(row["global_start_ms"]),
                global_end_ms=int(row["global_end_ms"]),
                storage_key=str(row["audio_storage_key"]),
                size_bytes=int(row["audio_size_bytes"]),
                checksum=str(row["audio_checksum"]),
                duration_ms=int(row["audio_duration_ms"]),
            )
            for row in rows
        ]

    async def load_beats(
        self, claimed: ClaimedProjectRenderJob
    ) -> list[ProjectRenderBeatAsset]:
        rows = await self._require_pool().fetch(
            """
            SELECT chapter_id, scene_index, beat_index, visual_beat_id,
                   global_start_ms, global_end_ms, duration_ms, camera_movement,
                   storage_key, size_bytes, checksum
              FROM project_render_input_beats
             WHERE generation_job_id = $1
             ORDER BY global_start_ms, scene_index, beat_index, visual_beat_id
            """,
            claimed.generation_job_id,
        )
        return [
            ProjectRenderBeatAsset(
                chapter_id=row["chapter_id"],
                scene_index=int(row["scene_index"]),
                beat_index=int(row["beat_index"]),
                visual_beat_id=row["visual_beat_id"],
                global_start_ms=int(row["global_start_ms"]),
                global_end_ms=int(row["global_end_ms"]),
                duration_ms=int(row["duration_ms"]),
                camera_movement=str(row["camera_movement"]),
                storage_key=str(row["storage_key"]),
                size_bytes=int(row["size_bytes"]),
                checksum=str(row["checksum"]),
            )
            for row in rows
        ]

    async def complete(
        self,
        claimed: ClaimedProjectRenderJob,
        *,
        render_fingerprint: str,
        media_asset: FinalVideoAsset,
        duration_ms: int,
        width: int,
        height: int,
        fps: int,
    ) -> None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                owned = await connection.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM stage_attempts
                         WHERE id = $1 AND worker_id = $2 AND lease_token = $3
                           AND status = 'RUNNING'
                    )
                    """,
                    claimed.stage_attempt_id,
                    claimed.worker_id,
                    claimed.lease_token,
                )
                if not owned:
                    raise ProjectRenderLeaseLostError(
                        "Worker lost the project render lease before completion"
                    )

                existing = await connection.fetchrow(
                    """
                    SELECT storage_key, storage_provider, external_file_id, checksum_sha256
                      FROM project_render_artifacts
                     WHERE generation_job_id = $1
                     LIMIT 1
                    """,
                    claimed.generation_job_id,
                )
                if existing is not None:
                    if (
                        str(existing["storage_key"]) != media_asset.storage_key
                        or str(existing["storage_provider"]) != media_asset.storage_provider
                        or str(existing["external_file_id"]) != media_asset.external_file_id
                        or str(existing["checksum_sha256"]) != media_asset.checksum
                    ):
                        raise ProjectRenderStateConflictError(
                            "Existing project artifact differs from immutable retry result"
                        )
                else:
                    await connection.execute(
                        """
                        INSERT INTO project_render_artifacts (
                            id, project_id, generation_job_id, render_fingerprint,
                            storage_key, storage_provider, external_file_id, web_view_link,
                            mime_type, size_bytes, checksum_sha256, duration_ms,
                            width, height, fps, status
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8,
                            'video/mp4', $9, $10, $11, $12, $13, $14, 'READY'
                        )
                        """,
                        uuid7(),
                        claimed.project_id,
                        claimed.generation_job_id,
                        render_fingerprint,
                        media_asset.storage_key,
                        media_asset.storage_provider,
                        media_asset.external_file_id,
                        media_asset.web_view_link,
                        media_asset.size_bytes,
                        media_asset.checksum,
                        duration_ms,
                        width,
                        height,
                        fps,
                    )

                stage = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'COMPLETED', heartbeat_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND lease_token = $3
                       AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    claimed.worker_id,
                    claimed.lease_token,
                )
                if stage != "UPDATE 1":
                    raise ProjectRenderLeaseLostError(
                        "Worker lost project render lease during completion"
                    )

                job = await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'COMPLETED', progress = 100, current_step = 'COMPLETED',
                           error_code = NULL, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status = 'RUNNING'
                    """,
                    claimed.generation_job_id,
                )
                if job != "UPDATE 1":
                    raise ProjectRenderStateConflictError(
                        "Project render generation job could not be completed"
                    )

    async def mark_stalled(self, claimed: ClaimedProjectRenderJob, error_code: str) -> bool:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                stage = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'STALLED', worker_id = NULL, lease_token = NULL,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND lease_token = $3
                       AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    claimed.worker_id,
                    claimed.lease_token,
                )
                if stage != "UPDATE 1":
                    return False
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'STALLED', current_step = 'RENDER_PROJECT_RETRY',
                           error_code = $2, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status = 'RUNNING'
                    """,
                    claimed.generation_job_id,
                    error_code[:80],
                )
                return True

    async def fail(self, claimed: ClaimedProjectRenderJob, error_code: str) -> None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                stage = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'FAILED', heartbeat_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND lease_token = $3
                       AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    claimed.worker_id,
                    claimed.lease_token,
                )
                if stage != "UPDATE 1":
                    return
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'FAILED', current_step = 'RENDER_PROJECT_FAILED',
                           error_code = $2, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status = 'RUNNING'
                    """,
                    claimed.generation_job_id,
                    error_code[:80],
                )

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("Project render repository is not connected")
        return self._pool
