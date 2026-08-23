"""Durable PostgreSQL repository for local chapter rendering."""

import json
import uuid
from dataclasses import dataclass

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.rendering.final_storage import FinalVideoAsset


class RenderLeaseLostError(RuntimeError):
    pass


class RenderStateConflictError(RuntimeError):
    pass


@dataclass(frozen=True)
class ClaimedRenderJob:
    stage_attempt_id: int
    generation_job_id: int
    job_id: str
    project_id: int
    project_owner_id: str
    chapter_id: int
    chapter_row_version: int
    source_hash: str
    media_plan_id: uuid.UUID
    media_plan_revision: int
    operation_type: str
    aspect_ratio: str
    narration_request_id: uuid.UUID | None
    narration_asset_id: uuid.UUID | None
    narration_alignment_id: uuid.UUID | None
    worker_id: str
    lease_token: uuid.UUID


@dataclass(frozen=True)
class RenderBeatAsset:
    scene_index: int
    beat_index: int
    visual_beat_id: int
    duration_ms: int | None
    camera_movement: str
    storage_key: str
    size_bytes: int
    checksum: str


@dataclass(frozen=True)
class RenderAudioAsset:
    storage_key: str
    size_bytes: int
    checksum: str
    duration_ms: int


class RenderRepository:
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

    async def claim_next(self, worker_id: str) -> ClaimedRenderJob | None:
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
                           gj.chapter_id,
                           gj.chapter_row_version,
                           gj.source_hash,
                           ris.media_plan_id,
                           ris.media_plan_revision,
                           op.operation_type,
                           COALESCE(mp.image_aspect_ratio, '16:9') AS aspect_ratio,
                           ris.narration_request_id,
                           ris.narration_asset_id,
                           ris.narration_alignment_id
                      FROM stage_attempts sa
                      JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                      JOIN projects p ON p.id = gj.project_id
                      JOIN render_input_snapshots ris ON ris.generation_job_id = gj.id
                      JOIN media_plans mp
                        ON mp.id = ris.media_plan_id
                       AND mp.revision = ris.media_plan_revision
                      JOIN operation_plans op ON op.generation_job_id = gj.id
                     WHERE gj.job_type = 'CHAPTER_RENDER'
                       AND gj.resource_class = 'CPU_RENDER'
                       AND gj.status IN ('QUEUED', 'RUNNING', 'STALLED')
                       AND sa.stage_name = 'CHAPTER_RENDER'
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
                lease_token = uuid.uuid4()
                parent = await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'RUNNING', progress = GREATEST(progress, 5),
                           current_step = 'CHAPTER_RENDER', error_code = NULL,
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
                    raise RenderStateConflictError(
                        f"stage_attempt_id={row['stage_attempt_id']} could not be claimed"
                    )
                return ClaimedRenderJob(
                    stage_attempt_id=int(row["stage_attempt_id"]),
                    generation_job_id=int(row["generation_job_id"]),
                    job_id=str(row["job_id"]),
                    project_id=int(row["project_id"]),
                    project_owner_id=str(row["project_owner_id"]),
                    chapter_id=int(row["chapter_id"]),
                    chapter_row_version=int(row["chapter_row_version"]),
                    source_hash=str(row["source_hash"]),
                    media_plan_id=row["media_plan_id"],
                    media_plan_revision=int(row["media_plan_revision"]),
                    operation_type=str(row["operation_type"]),
                    aspect_ratio=str(row["aspect_ratio"]),
                    narration_request_id=row["narration_request_id"],
                    narration_asset_id=row["narration_asset_id"],
                    narration_alignment_id=row["narration_alignment_id"],
                    worker_id=worker_id,
                    lease_token=lease_token,
                )

    async def heartbeat(self, claimed: ClaimedRenderJob) -> bool:
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

    async def assert_lease(self, claimed: ClaimedRenderJob) -> None:
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
            raise RenderLeaseLostError("Worker no longer owns the render lease")

    async def load_beats(self, claimed: ClaimedRenderJob) -> list[RenderBeatAsset]:
        rows = await self._require_pool().fetch(
            """
            SELECT scene_index,
                   beat_index,
                   visual_beat_id,
                   duration_ms,
                   camera_movement,
                   storage_key,
                   size_bytes,
                   checksum
              FROM render_input_snapshot_beats
             WHERE generation_job_id = $1
             ORDER BY scene_index, beat_index
            """,
            claimed.generation_job_id,
        )
        return [
            RenderBeatAsset(
                scene_index=int(row["scene_index"]),
                beat_index=int(row["beat_index"]),
                visual_beat_id=int(row["visual_beat_id"]),
                duration_ms=(int(row["duration_ms"]) if row["duration_ms"] is not None else None),
                camera_movement=str(row["camera_movement"]),
                storage_key=str(row["storage_key"]),
                size_bytes=int(row["size_bytes"]),
                checksum=str(row["checksum"]),
            )
            for row in rows
        ]

    async def load_audio(self, claimed: ClaimedRenderJob) -> RenderAudioAsset | None:
        row = await self._require_pool().fetchrow(
            """
            SELECT audio_storage_key,
                   audio_size_bytes,
                   audio_checksum,
                   audio_duration_ms
              FROM render_input_snapshots
             WHERE generation_job_id = $1
               AND narration_request_id = $2
               AND narration_asset_id = $3
               AND audio_storage_key IS NOT NULL
               AND audio_size_bytes IS NOT NULL
               AND audio_checksum IS NOT NULL
               AND audio_duration_ms IS NOT NULL
            """,
            claimed.generation_job_id,
            claimed.narration_request_id,
            claimed.narration_asset_id,
        )
        if row is None:
            return None
        return RenderAudioAsset(
            storage_key=str(row["audio_storage_key"]),
            size_bytes=int(row["audio_size_bytes"]),
            checksum=str(row["audio_checksum"]),
            duration_ms=int(row["audio_duration_ms"]),
        )

    async def complete(
        self,
        claimed: ClaimedRenderJob,
        *,
        render_fingerprint: str,
        manifest: dict[str, object],
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
                    raise RenderLeaseLostError("Worker lost the render lease before completion")

                manifest_id = await connection.fetchval(
                    """
                    INSERT INTO render_manifests
                        (project_id, chapter_id, media_plan_id, chapter_row_version,
                         source_hash, render_fingerprint, manifest_json, media_plan_revision,
                         project_owner_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
                    ON CONFLICT (render_fingerprint) DO NOTHING
                    RETURNING id
                    """,
                    claimed.project_id,
                    claimed.chapter_id,
                    claimed.media_plan_id,
                    claimed.chapter_row_version,
                    claimed.source_hash,
                    render_fingerprint,
                    json.dumps(manifest, sort_keys=True, separators=(",", ":")),
                    claimed.media_plan_revision,
                    claimed.project_owner_id,
                )
                if manifest_id is None:
                    manifest_id = await connection.fetchval(
                        "SELECT id FROM render_manifests WHERE render_fingerprint = $1",
                        render_fingerprint,
                    )
                if manifest_id is None:
                    raise RenderStateConflictError("Render manifest disappeared after insert")

                existing = await connection.fetchrow(
                    """
                    SELECT storage_key, storage_provider, external_file_id, checksum_sha256
                      FROM final_artifacts
                     WHERE chapter_id = $1 AND render_fingerprint = $2 AND status <> 'ARCHIVED'
                     LIMIT 1
                    """,
                    claimed.chapter_id,
                    render_fingerprint,
                )
                if existing is not None:
                    if (
                        str(existing["storage_key"]) != media_asset.storage_key
                        or str(existing["storage_provider"]) != media_asset.storage_provider
                        or str(existing["external_file_id"]) != media_asset.external_file_id
                        or str(existing["checksum_sha256"]) != media_asset.checksum
                    ):
                        raise RenderStateConflictError(
                            "Existing final artifact differs from immutable retry result"
                        )
                else:
                    await connection.execute(
                        """
                        INSERT INTO final_artifacts
                            (project_id, chapter_id, generation_job_id, render_manifest_id,
                             artifact_type, render_fingerprint, storage_key, storage_provider,
                             external_file_id, web_view_link, mime_type, size_bytes,
                             checksum_sha256, duration_ms, width, height, fps, status)
                        VALUES ($1, $2, $3, $4, 'CHAPTER_VIDEO', $5, $6, $7, $8, $9,
                                'video/mp4', $10, $11, $12, $13, $14, $15, 'READY')
                        """,
                        claimed.project_id,
                        claimed.chapter_id,
                        claimed.generation_job_id,
                        manifest_id,
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
                    raise RenderLeaseLostError("Worker lost render lease during completion")
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
                    raise RenderStateConflictError("Render generation job could not be completed")

    async def mark_stalled(self, claimed: ClaimedRenderJob, error_code: str) -> bool:
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
                       SET status = 'STALLED', current_step = 'CHAPTER_RENDER_RETRY',
                           error_code = $2, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status = 'RUNNING'
                    """,
                    claimed.generation_job_id,
                    error_code[:80],
                )
                return True

    async def fail(self, claimed: ClaimedRenderJob, error_code: str) -> None:
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
                       SET status = 'FAILED', current_step = 'FAILED', error_code = $2,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND status = 'RUNNING'
                    """,
                    claimed.generation_job_id,
                    error_code[:80],
                )

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("RenderRepository.connect() must be called before use")
        return self._pool
