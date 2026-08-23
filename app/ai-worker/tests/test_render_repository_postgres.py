"""PostgreSQL integration tests for chapter-render claim and artifact invariants."""

import asyncio
import os
from collections.abc import AsyncIterator
from uuid import uuid4

import asyncpg  # type: ignore[import-untyped]
import pytest

from narrativex_worker.rendering.final_storage import FinalVideoAsset
from narrativex_worker.rendering.repository import (
    ClaimedRenderJob,
    RenderLeaseLostError,
    RenderRepository,
    RenderStateConflictError,
)

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
SOURCE_HASH = "a" * 64
FINGERPRINT = "b" * 64

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL is required for PostgreSQL integration tests",
)


@pytest.fixture
async def postgres_database() -> AsyncIterator[str]:
    assert TEST_DATABASE_URL is not None
    connection = await asyncpg.connect(TEST_DATABASE_URL)
    try:
        await connection.execute(
            """
            DROP TABLE IF EXISTS final_artifacts CASCADE;
            DROP TABLE IF EXISTS render_manifests CASCADE;
            DROP TABLE IF EXISTS render_input_snapshot_beats CASCADE;
            DROP TABLE IF EXISTS render_input_snapshots CASCADE;
            DROP TABLE IF EXISTS operation_plans CASCADE;
            DROP TABLE IF EXISTS stage_attempts CASCADE;
            DROP TABLE IF EXISTS generation_jobs CASCADE;
            DROP TABLE IF EXISTS media_plans CASCADE;
            DROP TABLE IF EXISTS projects CASCADE;

            CREATE TABLE projects (
                id BIGINT PRIMARY KEY,
                owner_id TEXT NOT NULL
            );

            CREATE TABLE media_plans (
                id UUID PRIMARY KEY,
                revision INTEGER NOT NULL,
                image_aspect_ratio TEXT
            );

            CREATE TABLE generation_jobs (
                id BIGSERIAL PRIMARY KEY,
                row_version BIGINT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                job_id TEXT NOT NULL UNIQUE,
                project_id BIGINT NOT NULL REFERENCES projects(id),
                job_type TEXT NOT NULL,
                status TEXT NOT NULL,
                resource_class TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                current_step TEXT,
                error_code TEXT,
                requested_by_user_id TEXT NOT NULL,
                chapter_id BIGINT NOT NULL,
                chapter_row_version BIGINT NOT NULL,
                source_hash TEXT NOT NULL,
                media_plan_id UUID,
                media_plan_revision INTEGER
            );

            CREATE TABLE stage_attempts (
                id BIGSERIAL PRIMARY KEY,
                row_version BIGINT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                generation_job_id BIGINT NOT NULL REFERENCES generation_jobs(id),
                stage_name TEXT NOT NULL,
                attempt_number INTEGER NOT NULL,
                status TEXT NOT NULL,
                worker_id TEXT,
                heartbeat_at TIMESTAMPTZ,
                lease_token UUID,
                UNIQUE (generation_job_id, stage_name, attempt_number)
            );

            CREATE TABLE operation_plans (
                id BIGSERIAL PRIMARY KEY,
                generation_job_id BIGINT NOT NULL REFERENCES generation_jobs(id),
                operation_type TEXT NOT NULL
            );

            CREATE TABLE render_input_snapshots (
                generation_job_id BIGINT PRIMARY KEY REFERENCES generation_jobs(id),
                media_plan_id UUID NOT NULL,
                media_plan_revision INTEGER NOT NULL,
                narration_request_id UUID,
                narration_asset_id UUID,
                narration_alignment_id UUID,
                audio_storage_key TEXT,
                audio_size_bytes BIGINT,
                audio_checksum TEXT,
                audio_duration_ms BIGINT
            );

            CREATE TABLE render_input_snapshot_beats (
                generation_job_id BIGINT NOT NULL
                    REFERENCES render_input_snapshots(generation_job_id),
                scene_index INTEGER NOT NULL,
                beat_index INTEGER NOT NULL,
                visual_beat_id BIGINT NOT NULL,
                duration_ms BIGINT,
                camera_movement TEXT NOT NULL,
                storage_key TEXT NOT NULL,
                size_bytes BIGINT NOT NULL,
                checksum TEXT NOT NULL,
                PRIMARY KEY (generation_job_id, scene_index, beat_index)
            );

            CREATE TABLE render_manifests (
                id BIGSERIAL PRIMARY KEY,
                project_id BIGINT NOT NULL,
                chapter_id BIGINT NOT NULL,
                media_plan_id UUID,
                chapter_row_version BIGINT NOT NULL,
                source_hash TEXT NOT NULL,
                render_fingerprint TEXT NOT NULL UNIQUE,
                manifest_json JSONB NOT NULL,
                media_plan_revision INTEGER,
                project_owner_id TEXT
            );

            CREATE TABLE final_artifacts (
                id BIGSERIAL PRIMARY KEY,
                project_id BIGINT NOT NULL,
                chapter_id BIGINT,
                generation_job_id BIGINT,
                render_manifest_id BIGINT,
                artifact_type TEXT NOT NULL,
                render_fingerprint TEXT NOT NULL,
                storage_key TEXT NOT NULL,
                storage_provider TEXT NOT NULL,
                external_file_id TEXT,
                web_view_link TEXT,
                mime_type TEXT NOT NULL,
                size_bytes BIGINT,
                checksum_sha256 TEXT,
                duration_ms BIGINT,
                width INTEGER,
                height INTEGER,
                fps NUMERIC(8, 3),
                status TEXT NOT NULL DEFAULT 'READY'
            );
            CREATE UNIQUE INDEX uq_final_artifacts_chapter_render_fingerprint
                ON final_artifacts (chapter_id, render_fingerprint)
                WHERE chapter_id IS NOT NULL AND status <> 'ARCHIVED';

            INSERT INTO projects (id, owner_id) VALUES (1, 'owner-1');
            """
        )
        yield TEST_DATABASE_URL
    finally:
        await connection.execute(
            """
            DROP TABLE IF EXISTS final_artifacts CASCADE;
            DROP TABLE IF EXISTS render_manifests CASCADE;
            DROP TABLE IF EXISTS render_input_snapshot_beats CASCADE;
            DROP TABLE IF EXISTS render_input_snapshots CASCADE;
            DROP TABLE IF EXISTS operation_plans CASCADE;
            DROP TABLE IF EXISTS stage_attempts CASCADE;
            DROP TABLE IF EXISTS generation_jobs CASCADE;
            DROP TABLE IF EXISTS media_plans CASCADE;
            DROP TABLE IF EXISTS projects CASCADE;
            """
        )
        await connection.close()


async def seed_render_job(
    database_url: str,
    *,
    job_key: str = "render-job-1",
    chapter_id: int = 41,
    stage_status: str = "QUEUED",
) -> tuple[int, int]:
    media_plan_id = uuid4()
    connection = await asyncpg.connect(database_url)
    try:
        await connection.execute(
            "INSERT INTO media_plans (id, revision, image_aspect_ratio) VALUES ($1, 1, '16:9')",
            media_plan_id,
        )
        job_id = await connection.fetchval(
            """
            INSERT INTO generation_jobs (
                job_id, project_id, job_type, status, resource_class, progress, current_step,
                requested_by_user_id, chapter_id, chapter_row_version, source_hash,
                media_plan_id, media_plan_revision
            )
            VALUES ($1, 1, 'CHAPTER_RENDER', $2, 'CPU_RENDER', 0, 'QUEUED',
                    'owner-1', $3, 2, $4, $5, 1)
            RETURNING id
            """,
            job_key,
            "RUNNING" if stage_status == "RUNNING" else "QUEUED",
            chapter_id,
            SOURCE_HASH,
            media_plan_id,
        )
        stage_attempt_id = await connection.fetchval(
            """
            INSERT INTO stage_attempts (
                generation_job_id, stage_name, attempt_number, status,
                worker_id, heartbeat_at
            )
            VALUES ($1, 'CHAPTER_RENDER', 1, $2,
                    CASE WHEN $2 = 'RUNNING' THEN 'seed-worker' ELSE NULL END,
                    CASE WHEN $2 = 'RUNNING' THEN CURRENT_TIMESTAMP ELSE NULL END)
            RETURNING id
            """,
            job_id,
            stage_status,
        )
        await connection.execute(
            "INSERT INTO operation_plans (generation_job_id, operation_type) VALUES ($1, $2)",
            job_id,
            "CHAPTER_RENDER_720P_MP4",
        )
        await connection.execute(
            """
            INSERT INTO render_input_snapshots (
                generation_job_id, media_plan_id, media_plan_revision
            )
            VALUES ($1, $2, 1)
            """,
            job_id,
            media_plan_id,
        )
        return int(job_id), int(stage_attempt_id)
    finally:
        await connection.close()


async def expire_lease(database_url: str, stage_attempt_id: int) -> None:
    connection = await asyncpg.connect(database_url)
    try:
        await connection.execute(
            """
            UPDATE stage_attempts
               SET heartbeat_at = CURRENT_TIMESTAMP - INTERVAL '5 minutes'
             WHERE id = $1
            """,
            stage_attempt_id,
        )
    finally:
        await connection.close()


def video_asset(external_file_id: str, checksum: str = "c" * 64) -> FinalVideoAsset:
    return FinalVideoAsset(
        storage_provider="GOOGLE_DRIVE",
        storage_key=f"gdrive:{external_file_id}",
        external_file_id=external_file_id,
        web_view_link=f"https://drive.example/{external_file_id}",
        size_bytes=8,
        checksum=checksum,
        mime_type="video/mp4",
    )


async def complete_job(
    repository: RenderRepository,
    claimed: ClaimedRenderJob,
    asset: FinalVideoAsset,
    *,
    fingerprint: str = FINGERPRINT,
) -> None:
    await repository.complete(
        claimed,
        render_fingerprint=fingerprint,
        manifest={"test": True},
        media_asset=asset,
        duration_ms=1_000,
        width=1_280,
        height=720,
        fps=30,
    )


@pytest.mark.asyncio
async def test_two_workers_race_and_only_one_claims(postgres_database: str) -> None:
    await seed_render_job(postgres_database)
    first = RenderRepository(postgres_database, lease_seconds=30)
    second = RenderRepository(postgres_database, lease_seconds=30)
    await first.connect()
    await second.connect()
    try:
        claims = await asyncio.gather(
            first.claim_next("worker-a"),
            second.claim_next("worker-b"),
        )
    finally:
        await first.close()
        await second.close()

    claimed = [claim for claim in claims if claim is not None]
    assert len(claimed) == 1
    assert claimed[0].worker_id in {"worker-a", "worker-b"}


@pytest.mark.asyncio
async def test_stale_lease_is_reclaimed_by_replacement_worker(postgres_database: str) -> None:
    _, stage_attempt_id = await seed_render_job(
        postgres_database,
        stage_status="RUNNING",
    )
    stale = RenderRepository(postgres_database, lease_seconds=30)
    replacement = RenderRepository(postgres_database, lease_seconds=30)
    await stale.connect()
    await replacement.connect()
    try:
        stale_claim = await stale.claim_next("stale-worker")
        assert stale_claim is None
        await expire_lease(postgres_database, stage_attempt_id)
        replacement_claim = await replacement.claim_next("replacement-worker")
    finally:
        await stale.close()
        await replacement.close()

    assert replacement_claim is not None
    assert replacement_claim.worker_id == "replacement-worker"


@pytest.mark.asyncio
async def test_complete_is_rejected_for_stale_lease_owner(postgres_database: str) -> None:
    _, stage_attempt_id = await seed_render_job(postgres_database)
    stale = RenderRepository(postgres_database, lease_seconds=30)
    replacement = RenderRepository(postgres_database, lease_seconds=30)
    await stale.connect()
    await replacement.connect()
    try:
        stale_claim = await stale.claim_next("stale-worker")
        assert stale_claim is not None
        await expire_lease(postgres_database, stage_attempt_id)
        current_claim = await replacement.claim_next("replacement-worker")
        assert current_claim is not None

        with pytest.raises(RenderLeaseLostError):
            await complete_job(stale, stale_claim, video_asset("stale-file"))

        state = await replacement._require_pool().fetchrow(
            """
            SELECT gj.status AS job_status, sa.status AS stage_status,
                   COUNT(fa.id) AS artifact_count
              FROM generation_jobs gj
              JOIN stage_attempts sa ON sa.generation_job_id = gj.id
              LEFT JOIN final_artifacts fa ON fa.generation_job_id = gj.id
             WHERE gj.id = $1
             GROUP BY gj.status, sa.status
            """,
            current_claim.generation_job_id,
        )
    finally:
        await stale.close()
        await replacement.close()

    assert state is not None
    assert state["job_status"] == "RUNNING"
    assert state["stage_status"] == "RUNNING"
    assert state["artifact_count"] == 0


@pytest.mark.asyncio
async def test_final_artifact_rejects_different_content_for_same_fingerprint(
    postgres_database: str,
) -> None:
    await seed_render_job(postgres_database, job_key="render-job-1")
    await seed_render_job(postgres_database, job_key="render-job-2")
    repository = RenderRepository(postgres_database, lease_seconds=30)
    await repository.connect()
    try:
        first = await repository.claim_next("worker-a")
        assert first is not None
        await complete_job(repository, first, video_asset("drive-file-1"))

        second = await repository.claim_next("worker-b")
        assert second is not None
        with pytest.raises(RenderStateConflictError, match="immutable retry result"):
            await complete_job(repository, second, video_asset("drive-file-2"))

        count = await repository._require_pool().fetchval(
            """
            SELECT COUNT(*)
              FROM final_artifacts
             WHERE chapter_id = $1 AND render_fingerprint = $2
            """,
            first.chapter_id,
            FINGERPRINT,
        )
    finally:
        await repository.close()

    assert count == 1


@pytest.mark.asyncio
async def test_same_fingerprint_retry_is_idempotent_for_final_artifact(
    postgres_database: str,
) -> None:
    first_job_id, _ = await seed_render_job(postgres_database, job_key="render-job-1")
    second_job_id, _ = await seed_render_job(postgres_database, job_key="render-job-2")
    repository = RenderRepository(postgres_database, lease_seconds=30)
    await repository.connect()
    try:
        first = await repository.claim_next("worker-a")
        assert first is not None
        asset = video_asset("drive-file-1")
        await complete_job(repository, first, asset)

        second = await repository.claim_next("worker-b")
        assert second is not None
        await complete_job(repository, second, asset)

        rows = await repository._require_pool().fetch(
            """
            SELECT generation_job_id, storage_key, external_file_id, status
              FROM final_artifacts
             WHERE chapter_id = $1 AND render_fingerprint = $2
            """,
            first.chapter_id,
            FINGERPRINT,
        )
    finally:
        await repository.close()

    assert len(rows) == 1
    assert rows[0]["generation_job_id"] == first_job_id
    assert rows[0]["storage_key"] == asset.storage_key
    assert rows[0]["external_file_id"] == asset.external_file_id
    assert rows[0]["status"] == "READY"
    assert second_job_id != first_job_id


@pytest.mark.asyncio
async def test_job_completion_rolls_back_artifact_when_job_update_fails(
    postgres_database: str,
) -> None:
    generation_job_id, _ = await seed_render_job(postgres_database)
    repository = RenderRepository(postgres_database, lease_seconds=30)
    await repository.connect()
    try:
        claimed = await repository.claim_next("worker-a")
        assert claimed is not None
        await repository._require_pool().execute(
            "UPDATE generation_jobs SET status = 'COMPLETED' WHERE id = $1",
            generation_job_id,
        )

        with pytest.raises(RenderStateConflictError, match="could not be completed"):
            await complete_job(repository, claimed, video_asset("drive-file-1"))

        state = await repository._require_pool().fetchrow(
            """
            SELECT gj.status AS job_status, sa.status AS stage_status,
                   COUNT(fa.id) AS artifact_count
              FROM generation_jobs gj
              JOIN stage_attempts sa ON sa.generation_job_id = gj.id
              LEFT JOIN final_artifacts fa ON fa.generation_job_id = gj.id
             WHERE gj.id = $1
             GROUP BY gj.status, sa.status
            """,
            generation_job_id,
        )
    finally:
        await repository.close()

    assert state is not None
    assert state["job_status"] == "COMPLETED"
    assert state["stage_status"] == "RUNNING"
    assert state["artifact_count"] == 0


@pytest.mark.asyncio
async def test_completed_chapter_render_has_exactly_one_ready_artifact(
    postgres_database: str,
) -> None:
    await seed_render_job(postgres_database)
    repository = RenderRepository(postgres_database, lease_seconds=30)
    await repository.connect()
    try:
        claimed = await repository.claim_next("worker-a")
        assert claimed is not None
        await complete_job(repository, claimed, video_asset("drive-file-1"))
        invariant = await repository._require_pool().fetchrow(
            """
            SELECT gj.status, gj.job_type,
                   COUNT(fa.id) FILTER (WHERE fa.status = 'READY') AS ready_artifacts
              FROM generation_jobs gj
              LEFT JOIN final_artifacts fa
                ON fa.generation_job_id = gj.id
             WHERE gj.id = $1
             GROUP BY gj.status, gj.job_type
            """,
            claimed.generation_job_id,
        )
    finally:
        await repository.close()

    assert invariant is not None
    assert invariant["status"] == "COMPLETED"
    assert invariant["job_type"] == "CHAPTER_RENDER"
    assert invariant["ready_artifacts"] == 1
