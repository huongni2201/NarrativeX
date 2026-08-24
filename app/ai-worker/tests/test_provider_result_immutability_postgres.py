"""PostgreSQL regression tests for immutable completed provider results."""

import asyncio
import os
from collections.abc import AsyncIterator
from typing import cast
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-untyped]
import pytest

from narrativex_worker.repository import (
    ClaimedChapterAnalysisJob,
    DurableProviderOperation,
    ProviderResultConflictError,
    WorkerRepository,
)
from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    SceneAnalysis,
    VisualBeatAnalysis,
)

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
SOURCE_HASH = "c" * 64
PROJECT_ID = UUID("00000000-0000-4000-8000-000000000021")
STORY_VERSION_ID = UUID("00000000-0000-4000-8000-000000000022")
CHAPTER_ID = UUID("00000000-0000-4000-8000-000000000023")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL is required for PostgreSQL integration tests",
)


@pytest.fixture
async def immutable_result_database() -> AsyncIterator[str]:
    assert TEST_DATABASE_URL is not None
    connection = await asyncpg.connect(TEST_DATABASE_URL)
    try:
        await connection.execute(
            """
            DROP TABLE IF EXISTS provider_operations;
            DROP TABLE IF EXISTS stage_attempts;
            DROP TABLE IF EXISTS generation_jobs;

            CREATE TABLE generation_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID NOT NULL UNIQUE,
                project_id UUID NOT NULL,
                story_version_id UUID NOT NULL,
                chapter_id UUID NOT NULL,
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
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                generation_job_id UUID NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
                status TEXT NOT NULL,
                worker_id TEXT,
                heartbeat_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                row_version BIGINT NOT NULL DEFAULT 0
            );

            CREATE TABLE provider_operations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                stage_attempt_id UUID NOT NULL REFERENCES stage_attempts(id) ON DELETE CASCADE,
                provider_key TEXT NOT NULL,
                request_fingerprint TEXT NOT NULL,
                provider_operation_id TEXT,
                status TEXT NOT NULL,
                normalized_result_json JSONB,
                result_fingerprint VARCHAR(64),
                completed_at TIMESTAMPTZ,
                reserved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                row_version BIGINT NOT NULL DEFAULT 0,
                next_reconcile_at TIMESTAMPTZ,
                reconcile_attempts INTEGER NOT NULL DEFAULT 0,
                last_reconcile_error TEXT,
                UNIQUE (provider_key, request_fingerprint),
                CHECK (
                    status <> 'COMPLETED'
                    OR (normalized_result_json IS NOT NULL AND result_fingerprint IS NOT NULL)
                )
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


async def seed_operation(
    database_url: str,
    fingerprint: str,
) -> tuple[WorkerRepository, DurableProviderOperation]:
    connection = await asyncpg.connect(database_url)
    job_key = uuid4()
    try:
        job_id = await connection.fetchval(
            """
            INSERT INTO generation_jobs (
                job_id, project_id, story_version_id, chapter_id, chapter_row_version,
                source_hash, source_text, source_language, requested_by_user_id,
                job_type, status
            ) VALUES (
                $1, $2, $3, $4, 4, $5, 'Story', 'vi-VN', 'user-1',
                'CHAPTER_ANALYZE', 'QUEUED'
            ) RETURNING id
            """,
            job_key,
            PROJECT_ID,
            STORY_VERSION_ID,
            CHAPTER_ID,
            SOURCE_HASH,
        )
        stage_id = await connection.fetchval(
            """
            INSERT INTO stage_attempts (generation_job_id, status)
            VALUES ($1, 'QUEUED')
            RETURNING id
            """,
            job_id,
        )
    finally:
        await connection.close()

    claimed = ClaimedChapterAnalysisJob(
        stage_attempt_id=cast(UUID, stage_id),
        generation_job_id=cast(UUID, job_id),
        job_id=str(job_key),
        requested_by_user_id="user-1",
        request=ChapterAnalysisRequest(
            project_id=PROJECT_ID,
            story_version_id=STORY_VERSION_ID,
            chapter_id=CHAPTER_ID,
            chapter_row_version=4,
            source_hash=SOURCE_HASH,
            source_text="Story",
        ),
    )
    repository = WorkerRepository(database_url, lease_seconds=30)
    await repository.connect()
    reserved = await repository.reserve_provider_operation(claimed, "vertex", fingerprint)
    unknown = await repository.mark_provider_operation_submission_unknown(reserved, 30.0)
    return repository, unknown


def result(narration: str) -> ChapterAnalysisResult:
    return ChapterAnalysisResult(
        scenes=[
            SceneAnalysis(
                title="Opening",
                narration=narration,
                visual_beats=[VisualBeatAnalysis(title="Door", visual_intent="Warm light")],
            )
        ]
    )


async def row(database_url: str, operation_id: UUID) -> asyncpg.Record:
    connection = await asyncpg.connect(database_url)
    try:
        value = await connection.fetchrow(
            """
            SELECT status, normalized_result_json, result_fingerprint,
                   completed_at, updated_at, row_version
              FROM provider_operations
             WHERE id = $1
            """,
            operation_id,
        )
        assert value is not None
        return cast(asyncpg.Record, value)
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_same_completed_result_is_idempotent_without_mutation(
    immutable_result_database: str,
) -> None:
    repository, operation = await seed_operation(immutable_result_database, "same-result")
    try:
        completed = await repository.persist_provider_result(operation, "provider-1", result("A"))
        before = await row(immutable_result_database, operation.id)
        duplicate = await repository.persist_provider_result(completed, "provider-2", result("A"))
        after = await row(immutable_result_database, operation.id)
    finally:
        await repository.close()

    assert completed.result_fingerprint == duplicate.result_fingerprint
    assert completed.normalized_result == duplicate.normalized_result
    assert after["row_version"] == before["row_version"]
    assert after["completed_at"] == before["completed_at"]
    assert after["updated_at"] == before["updated_at"]


@pytest.mark.asyncio
async def test_different_completed_result_preserves_first_result(
    immutable_result_database: str,
) -> None:
    repository, operation = await seed_operation(immutable_result_database, "conflicting-result")
    try:
        completed = await repository.persist_provider_result(operation, "provider-1", result("A"))
        before = await row(immutable_result_database, operation.id)
        with pytest.raises(ProviderResultConflictError):
            await repository.persist_provider_result(completed, "provider-2", result("B"))
        after = await row(immutable_result_database, operation.id)
    finally:
        await repository.close()

    assert after["normalized_result_json"] == before["normalized_result_json"]
    assert after["result_fingerprint"] == before["result_fingerprint"]
    assert after["row_version"] == before["row_version"]


@pytest.mark.asyncio
async def test_concurrent_conflicting_completions_have_one_winner(
    immutable_result_database: str,
) -> None:
    first, operation = await seed_operation(immutable_result_database, "concurrent-result")
    second = WorkerRepository(immutable_result_database, lease_seconds=30)
    await second.connect()
    try:
        stale = await second.get_provider_operation(operation.id)
        outcomes = await asyncio.gather(
            first.persist_provider_result(operation, "provider-1", result("A")),
            second.persist_provider_result(stale, "provider-2", result("B")),
            return_exceptions=True,
        )
        persisted = await row(immutable_result_database, operation.id)
    finally:
        await first.close()
        await second.close()

    successes = [item for item in outcomes if isinstance(item, DurableProviderOperation)]
    conflicts = [item for item in outcomes if isinstance(item, ProviderResultConflictError)]
    assert len(successes) == 1
    assert len(conflicts) == 1
    assert persisted["status"] == "COMPLETED"
    assert persisted["result_fingerprint"] == successes[0].result_fingerprint
