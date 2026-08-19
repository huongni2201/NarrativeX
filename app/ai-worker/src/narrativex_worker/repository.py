"""PostgreSQL source-of-truth repository for worker claim/lease and analysis materialization."""

import hashlib
import json
from dataclasses import dataclass

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    ProviderOperationStatus,
)


@dataclass(frozen=True)
class DurableProviderOperation:
    id: int
    stage_attempt_id: int
    provider_key: str
    provider_operation_id: str | None
    status: ProviderOperationStatus
    request_fingerprint: str
    normalized_result: ChapterAnalysisResult | None = None
    created: bool = False


@dataclass(frozen=True)
class ClaimedChapterAnalysisJob:
    stage_attempt_id: int
    generation_job_id: int
    job_id: str
    requested_by_user_id: str
    request: ChapterAnalysisRequest


class WorkerRepository:
    def __init__(self, database_url: str, lease_seconds: int, pool_size: int = 5) -> None:
        self.database_url = database_url
        self.lease_seconds = lease_seconds
        self.pool_size = pool_size
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

    async def claim_next(self, worker_id: str) -> ClaimedChapterAnalysisJob | None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT sa.id AS stage_attempt_id,
                           sa.generation_job_id,
                           gj.job_id,
                           gj.project_id,
                           gj.story_version_id,
                           gj.chapter_id,
                           gj.chapter_row_version,
                           gj.source_hash,
                           gj.source_text,
                           gj.source_language,
                           gj.requested_by_user_id
                      FROM stage_attempts sa
                      JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                     WHERE gj.job_type = 'CHAPTER_ANALYZE'
                       AND gj.status IN ('QUEUED', 'RUNNING', 'STALLED')
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

                await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'RUNNING', worker_id = $1, heartbeat_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $2
                    """,
                    worker_id,
                    row["stage_attempt_id"],
                )
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'RUNNING', progress = GREATEST(progress, 5),
                           current_step = 'CHAPTER_ANALYSIS', updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status <> 'COMPLETED'
                    """,
                    row["generation_job_id"],
                )

                request = ChapterAnalysisRequest(
                    project_id=row["project_id"],
                    story_version_id=row["story_version_id"],
                    chapter_id=row["chapter_id"],
                    chapter_row_version=row["chapter_row_version"],
                    source_hash=row["source_hash"],
                    source_text=row["source_text"],
                    source_language=row["source_language"],
                )
                return ClaimedChapterAnalysisJob(
                    stage_attempt_id=row["stage_attempt_id"],
                    generation_job_id=row["generation_job_id"],
                    job_id=row["job_id"],
                    requested_by_user_id=row["requested_by_user_id"],
                    request=request,
                )

    async def heartbeat(self, stage_attempt_id: int, worker_id: str) -> bool:
        pool = self._require_pool()
        result = await pool.execute(
            """
            UPDATE stage_attempts
               SET heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
            """,
            stage_attempt_id,
            worker_id,
        )
        return str(result) == "UPDATE 1"

    async def reserve_provider_operation(
        self,
        claimed: ClaimedChapterAnalysisJob,
        provider_key: str,
        request_fingerprint: str,
    ) -> DurableProviderOperation:
        """Commit a provider reservation before crossing the external-provider boundary."""
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    INSERT INTO provider_operations
                      (stage_attempt_id, provider_key, request_fingerprint, status)
                    VALUES ($1, $2, $3, 'RESERVED')
                    ON CONFLICT (provider_key, request_fingerprint) DO NOTHING
                    RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                              status, request_fingerprint, normalized_result_json
                    """,
                    claimed.stage_attempt_id,
                    provider_key,
                    request_fingerprint,
                )
                created = row is not None
                if row is None:
                    row = await connection.fetchrow(
                        """
                        SELECT id, stage_attempt_id, provider_key, provider_operation_id,
                               status, request_fingerprint, normalized_result_json
                          FROM provider_operations
                         WHERE provider_key = $1 AND request_fingerprint = $2
                         FOR UPDATE
                        """,
                        provider_key,
                        request_fingerprint,
                    )
                if row is None:
                    raise RuntimeError("Provider operation reservation disappeared")
                return self._provider_operation(row, created=created)

    async def mark_provider_operation_submitted(
        self, operation_id: int, provider_operation_id: str | None
    ) -> DurableProviderOperation:
        return await self._update_provider_operation(
            operation_id, ProviderOperationStatus.SUBMITTED, provider_operation_id
        )

    async def persist_provider_result(
        self,
        operation_id: int,
        provider_operation_id: str | None,
        result: ChapterAnalysisResult,
    ) -> DurableProviderOperation:
        """Atomically persist the normalized provider result and terminal provider status."""
        pool = self._require_pool()
        serialized = result.model_dump_json()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    UPDATE provider_operations
                       SET status = 'COMPLETED',
                           provider_operation_id = COALESCE($2, provider_operation_id),
                           normalized_result_json = $3::jsonb,
                           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status <> 'FAILED'
                     RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                               status, request_fingerprint, normalized_result_json
                    """,
                    operation_id,
                    provider_operation_id,
                    serialized,
                )
        if row is None:
            raise RuntimeError(f"Provider operation {operation_id} cannot persist a result")
        return self._provider_operation(row)

    async def mark_provider_operation_status(
        self,
        operation_id: int,
        status: ProviderOperationStatus,
        provider_operation_id: str | None = None,
    ) -> DurableProviderOperation:
        if status is ProviderOperationStatus.COMPLETED:
            raise ValueError("COMPLETED requires persist_provider_result() with a durable result")
        return await self._update_provider_operation(operation_id, status, provider_operation_id)

    async def list_provider_operations(
        self, statuses: tuple[ProviderOperationStatus, ...], limit: int = 50
    ) -> list[DurableProviderOperation]:
        pool = self._require_pool()
        rows = await pool.fetch(
            """
            SELECT id, stage_attempt_id, provider_key, provider_operation_id,
                   status, request_fingerprint, normalized_result_json
              FROM provider_operations
             WHERE status = ANY($1::text[])
             ORDER BY reserved_at, id
             LIMIT $2
            """,
            [status.value for status in statuses],
            limit,
        )
        return [self._provider_operation(row) for row in rows]

    async def _update_provider_operation(
        self,
        operation_id: int,
        status: ProviderOperationStatus,
        provider_operation_id: str | None = None,
    ) -> DurableProviderOperation:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                UPDATE provider_operations
                   SET status = $2,
                       provider_operation_id = COALESCE($3, provider_operation_id),
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                 WHERE id = $1
                 RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                           status, request_fingerprint, normalized_result_json
                """,
                operation_id,
                status.value,
                provider_operation_id,
            )
        if row is None:
            raise RuntimeError(f"Provider operation {operation_id} not found")
        return self._provider_operation(row)

    @staticmethod
    def _provider_operation(
        row: asyncpg.Record, *, created: bool = False
    ) -> DurableProviderOperation:
        raw_result = row["normalized_result_json"]
        normalized_result: ChapterAnalysisResult | None = None
        if raw_result is not None:
            parsed_result = json.loads(raw_result) if isinstance(raw_result, str) else raw_result
            normalized_result = ChapterAnalysisResult.model_validate(parsed_result)
        return DurableProviderOperation(
            id=row["id"],
            stage_attempt_id=row["stage_attempt_id"],
            provider_key=row["provider_key"],
            provider_operation_id=row["provider_operation_id"],
            status=ProviderOperationStatus(row["status"]),
            request_fingerprint=row["request_fingerprint"],
            normalized_result=normalized_result,
            created=created,
        )

    async def complete(
        self,
        claimed: ClaimedChapterAnalysisJob,
        worker_id: str,
        result: ChapterAnalysisResult,
    ) -> None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                lease_owned = await connection.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM stage_attempts
                         WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    )
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if not lease_owned:
                    raise RuntimeError("Worker no longer owns the analysis lease")

                snapshot_matches = await connection.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM chapters
                         WHERE id = $1 AND story_version_id = $2
                           AND row_version = $3 AND source_hash = $4
                    )
                    """,
                    claimed.request.chapter_id,
                    claimed.request.story_version_id,
                    claimed.request.chapter_row_version,
                    claimed.request.source_hash,
                )
                if not snapshot_matches:
                    raise RuntimeError("Chapter changed while analysis was running")

                await connection.execute(
                    "SELECT pg_advisory_xact_lock($1)",
                    claimed.request.project_id,
                )
                project_characters = await self._materialize_characters(connection, claimed, result)
                project_locations = await self._materialize_locations(connection, claimed, result)
                await self._materialize_storyboard(
                    connection,
                    claimed,
                    result,
                    project_characters,
                    project_locations,
                )
                stage_update = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'COMPLETED', heartbeat_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if stage_update != "UPDATE 1":
                    raise RuntimeError("Worker lost the analysis lease before completion")
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'COMPLETED', progress = 100, current_step = 'COMPLETED',
                           error_code = NULL, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                    """,
                    claimed.generation_job_id,
                )

    async def fail(
        self,
        claimed: ClaimedChapterAnalysisJob,
        worker_id: str,
        error_code: str,
    ) -> None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                stage_update = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'FAILED', heartbeat_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if stage_update != "UPDATE 1":
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

    @staticmethod
    async def _materialize_characters(
        connection: asyncpg.Connection,
        claimed: ClaimedChapterAnalysisJob,
        result: ChapterAnalysisResult,
    ) -> dict[str, int]:
        """Resolve character keys through durable project identity, never through display name."""
        from narrativex_worker.identity_repository import IdentityAwareWorkerRepository

        return await IdentityAwareWorkerRepository._materialize_characters(
            connection,
            claimed,
            result,
        )

    @staticmethod
    async def _materialize_locations(
        connection: asyncpg.Connection,
        claimed: ClaimedChapterAnalysisJob,
        result: ChapterAnalysisResult,
    ) -> dict[str, int]:
        """Resolve location keys through durable project identity, never through display name."""
        from narrativex_worker.identity_repository import IdentityAwareWorkerRepository

        return await IdentityAwareWorkerRepository._materialize_locations(
            connection,
            claimed,
            result,
        )

    @staticmethod
    async def _materialize_storyboard(
        connection: asyncpg.Connection,
        claimed: ClaimedChapterAnalysisJob,
        result: ChapterAnalysisResult,
        project_characters: dict[str, int],
        project_locations: dict[str, int],
    ) -> None:
        protected_storyboard = await connection.fetchval(
            """
            SELECT EXISTS(
                SELECT 1
                  FROM scenes s
                  LEFT JOIN visual_beats vb ON vb.scene_id = s.id
                 WHERE s.chapter_id = $1
                   AND (s.status = 'APPROVED' OR vb.review_status = 'APPROVED')
            )
            """,
            claimed.request.chapter_id,
        )
        if protected_storyboard:
            raise RuntimeError(
                "Chapter storyboard contains approved output; explicit reset is required "
                "before re-analysis"
            )

        await connection.execute(
            """
            DELETE FROM visual_beats
             WHERE scene_id IN (SELECT id FROM scenes WHERE chapter_id = $1)
            """,
            claimed.request.chapter_id,
        )
        await connection.execute(
            "DELETE FROM scenes WHERE chapter_id = $1",
            claimed.request.chapter_id,
        )

        if not result.scenes:
            return

        location_ids = [
            project_locations[scene.location_key] if scene.location_key is not None else None
            for scene in result.scenes
        ]
        scene_rows = await connection.fetch(
            """
            INSERT INTO scenes
              (chapter_id, order_index, title, narration, project_location_id, status)
            SELECT $1, source.order_index, source.title, source.narration,
                   source.project_location_id, 'DRAFT'
              FROM UNNEST($2::int[], $3::text[], $4::text[], $5::bigint[])
                   AS source(order_index, title, narration, project_location_id)
             ORDER BY source.order_index
            RETURNING id, order_index
            """,
            claimed.request.chapter_id,
            list(range(len(result.scenes))),
            [scene.title for scene in result.scenes],
            [scene.narration or "" for scene in result.scenes],
            location_ids,
        )
        scene_ids = {row["order_index"]: row["id"] for row in scene_rows}

        scene_character_rows = [
            (
                scene_ids[scene_index],
                character_index,
                project_characters[character.character_key],
            )
            for scene_index, scene in enumerate(result.scenes)
            for character_index, character in enumerate(scene.characters)
        ]
        if scene_character_rows:
            await connection.executemany(
                """
                INSERT INTO scene_characters
                  (scene_id, order_index, project_character_id)
                VALUES ($1, $2, $3)
                """,
                scene_character_rows,
            )

        beat_rows = [
            (
                scene_ids[scene_index],
                beat_index,
                beat.title,
                beat.visual_intent,
            )
            for scene_index, scene in enumerate(result.scenes)
            for beat_index, beat in enumerate(scene.visual_beats)
        ]
        if beat_rows:
            await connection.executemany(
                """
                INSERT INTO visual_beats
                  (scene_id, order_index, title, visual_intent, motion_mode,
                   camera_movement, review_status)
                VALUES ($1, $2, $3, $4, 'STILL', 'NONE', 'NEEDS_REVIEW')
                """,
                beat_rows,
            )

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("WorkerRepository.connect() must be called before use")
        return self._pool


def provider_request_fingerprint(claimed: ClaimedChapterAnalysisJob, provider_key: str) -> str:
    payload = "|".join(
        (
            provider_key,
            "CHAPTER_ANALYZE",
            str(claimed.generation_job_id),
            str(claimed.request.chapter_id),
            claimed.request.source_hash,
        )
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
