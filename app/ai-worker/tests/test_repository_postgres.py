"""PostgreSQL integration tests for worker claim/lease and provider reservations."""

import asyncio
import os
from collections.abc import AsyncIterator

import asyncpg  # type: ignore[import-untyped]
import pytest

from narrativex_worker.repository import ClaimedChapterAnalysisJob, WorkerRepository
from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    ProviderOperationStatus,
    SceneAnalysis,
    VisualBeatAnalysis,
)

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
SOURCE_HASH = "b" * 64

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
            DROP TABLE IF EXISTS provider_operations;
            DROP TABLE IF EXISTS stage_attempts;
            DROP TABLE IF EXISTS generation_jobs;

            CREATE TABLE generation_jobs (
                id BIGSERIAL PRIMARY KEY,
                job_id TEXT NOT NULL UNIQUE,
                project_id BIGINT NOT NULL,
                story_version_id BIGINT NOT NULL,
                chapter_id BIGINT NOT NULL,
                chapter_row_version BIGINT NOT NULL,
                source_hash TEXT NOT NULL,
                source_text TEXT NOT NULL,
                source_language TEXT NOT NULL,
                requested_by_user_id TEXT NOT NULL,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                current_step TEXT NOT NULL DEFAULT 'QUEUED',
                error_code TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                row_version BIGINT NOT NULL DEFAULT 0
            );

            CREATE TABLE stage_attempts (
                id BIGSERIAL PRIMARY KEY,
                generation_job_id BIGINT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
                status TEXT NOT NULL,
                worker_id TEXT,
                heartbeat_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                row_version BIGINT NOT NULL DEFAULT 0
            );

            CREATE TABLE provider_operations (
                id BIGSERIAL PRIMARY KEY,
                stage_attempt_id BIGINT NOT NULL REFERENCES stage_attempts(id) ON DELETE CASCADE,
                provider_key TEXT NOT NULL,
                request_fingerprint TEXT NOT NULL,
                provider_operation_id TEXT,
                status TEXT NOT NULL,
                normalized_result_json JSONB,
                completed_at TIMESTAMPTZ,
                reserved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                row_version BIGINT NOT NULL DEFAULT 0,
                UNIQUE (provider_key, request_fingerprint),
                CHECK (status <> 'COMPLETED' OR normalized_result_json IS NOT NULL)
            );
            """
        )
        yield TEST_DATABASE_URL
    finally:
        await connection.execute(
            """
            DROP TABLE IF EXISTS provider_operations;
            DROP TABLE IF EXISTS stage_attempts;
            DROP TABLE IF EXISTS generation_jobs;
            """
        )
        await connection.close()


async def seed_job(database_url: str, *, stage_status: str = "QUEUED") -> tuple[int, int]:
    connection = await asyncpg.connect(database_url)
    try:
        generation_job_id = await connection.fetchval(
            """
            INSERT INTO generation_jobs (
                job_id, project_id, story_version_id, chapter_id, chapter_row_version,
                source_hash, source_text, source_language, requested_by_user_id,
                job_type, status
            )
            VALUES (
                'job-1', 1, 2, 3, 4,
                $1, 'PostgreSQL integration story', 'vi-VN', 'user-1',
                'CHAPTER_ANALYZE', 'QUEUED'
            )
            RETURNING id
            """,
            SOURCE_HASH,
        )
        stage_attempt_id = await connection.fetchval(
            """
            INSERT INTO stage_attempts (generation_job_id, status)
            VALUES ($1, $2)
            RETURNING id
            """,
            generation_job_id,
            stage_status,
        )
        return int(generation_job_id), int(stage_attempt_id)
    finally:
        await connection.close()


def chapter_result() -> ChapterAnalysisResult:
    return ChapterAnalysisResult(
        scenes=[
            SceneAnalysis(
                title="Opening",
                narration="A door opens.",
                visual_beats=[VisualBeatAnalysis(title="Door", visual_intent="Warm light")],
            )
        ]
    )


@pytest.mark.asyncio
async def test_two_workers_cannot_claim_same_stage_attempt(postgres_database: str) -> None:
    await seed_job(postgres_database)
    first = WorkerRepository(postgres_database, lease_seconds=30)
    second = WorkerRepository(postgres_database, lease_seconds=30)
    await first.connect()
    await second.connect()
    try:
        claims = await asyncio.gather(first.claim_next("worker-a"), second.claim_next("worker-b"))
    finally:
        await first.close()
        await second.close()

    claimed = [claim for claim in claims if claim is not None]
    assert len(claimed) == 1
    assert claimed[0].job_id == "job-1"


@pytest.mark.asyncio
async def test_stale_running_lease_is_reclaimed(postgres_database: str) -> None:
    _, stage_attempt_id = await seed_job(postgres_database, stage_status="RUNNING")
    connection = await asyncpg.connect(postgres_database)
    try:
        await connection.execute(
            """
            UPDATE stage_attempts
               SET worker_id = 'dead-worker',
                   heartbeat_at = CURRENT_TIMESTAMP - INTERVAL '5 minutes'
             WHERE id = $1
            """,
            stage_attempt_id,
        )
        await connection.execute("UPDATE generation_jobs SET status = 'RUNNING'")
    finally:
        await connection.close()

    repository = WorkerRepository(postgres_database, lease_seconds=30)
    await repository.connect()
    try:
        claimed = await repository.claim_next("replacement-worker")
    finally:
        await repository.close()

    assert claimed is not None
    assert claimed.stage_attempt_id == stage_attempt_id


@pytest.mark.asyncio
async def test_provider_reservation_is_unique_across_workers(postgres_database: str) -> None:
    generation_job_id, stage_attempt_id = await seed_job(postgres_database)
    claimed = ClaimedChapterAnalysisJob(
        stage_attempt_id=stage_attempt_id,
        generation_job_id=generation_job_id,
        job_id="job-1",
        requested_by_user_id="user-1",
        request=ChapterAnalysisRequest(
            project_id=1,
            story_version_id=2,
            chapter_id=3,
            chapter_row_version=4,
            source_hash=SOURCE_HASH,
            source_text="PostgreSQL integration story",
        ),
    )

    first = WorkerRepository(postgres_database, lease_seconds=30)
    second = WorkerRepository(postgres_database, lease_seconds=30)
    await first.connect()
    await second.connect()
    try:
        reservations = await asyncio.gather(
            first.reserve_provider_operation(claimed, "vertex", "stable-fingerprint"),
            second.reserve_provider_operation(claimed, "vertex", "stable-fingerprint"),
        )
    finally:
        await first.close()
        await second.close()

    assert reservations[0].id == reservations[1].id
    assert sum(1 for reservation in reservations if reservation.created) == 1


@pytest.mark.asyncio
async def test_provider_result_and_completed_status_persist_atomically(
    postgres_database: str,
) -> None:
    generation_job_id, stage_attempt_id = await seed_job(postgres_database)
    claimed = ClaimedChapterAnalysisJob(
        stage_attempt_id=stage_attempt_id,
        generation_job_id=generation_job_id,
        job_id="job-1",
        requested_by_user_id="user-1",
        request=ChapterAnalysisRequest(
            project_id=1,
            story_version_id=2,
            chapter_id=3,
            chapter_row_version=4,
            source_hash=SOURCE_HASH,
            source_text="PostgreSQL integration story",
        ),
    )

    repository = WorkerRepository(postgres_database, lease_seconds=30)
    await repository.connect()
    try:
        reserved = await repository.reserve_provider_operation(
            claimed, "vertex", "durable-result-fingerprint"
        )
        await repository.mark_provider_operation_submitted(reserved.id, None)
        persisted = await repository.persist_provider_result(
            reserved.id, "vertex-response-1", chapter_result()
        )
        reloaded = await repository.reserve_provider_operation(
            claimed, "vertex", "durable-result-fingerprint"
        )
    finally:
        await repository.close()

    assert persisted.status is ProviderOperationStatus.COMPLETED
    assert persisted.normalized_result == chapter_result()
    assert reloaded.status is ProviderOperationStatus.COMPLETED
    assert reloaded.normalized_result == chapter_result()
    assert not reloaded.created
