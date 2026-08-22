"""PostgreSQL integration tests for media-validation lease fencing."""

import os
from collections.abc import AsyncIterator
from uuid import UUID, uuid4

import asyncpg
import pytest

from narrativex_worker.media_validation_repository import (
    LeaseLostError,
    MediaValidationRepository,
)

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL is required for PostgreSQL integration tests",
)


@pytest.fixture
async def media_database() -> AsyncIterator[str]:
    assert TEST_DATABASE_URL is not None
    connection = await asyncpg.connect(TEST_DATABASE_URL)
    try:
        await connection.execute(
            """
            DROP TABLE IF EXISTS media_storage_cleanup_tasks;
            DROP TABLE IF EXISTS media_upload_sessions;
            DROP TABLE IF EXISTS media_validation_jobs;
            DROP TABLE IF EXISTS media_assets;

            CREATE TABLE media_assets (
                id UUID PRIMARY KEY,
                account_id TEXT NOT NULL,
                status VARCHAR(24) NOT NULL,
                detected_content_type TEXT,
                detected_container TEXT,
                detected_codec TEXT,
                width INTEGER,
                height INTEGER,
                duration_ms BIGINT,
                validation_error_code TEXT,
                validation_error_detail TEXT,
                validated_at TIMESTAMPTZ,
                checksum_verified_at TIMESTAMPTZ
            );

            CREATE TABLE media_validation_jobs (
                id UUID PRIMARY KEY,
                account_id TEXT NOT NULL,
                media_asset_id UUID NOT NULL UNIQUE REFERENCES media_assets(id),
                storage_key TEXT NOT NULL,
                declared_type TEXT NOT NULL,
                declared_content_type TEXT NOT NULL,
                expected_size_bytes BIGINT NOT NULL,
                expected_sha256 TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'QUEUED',
                attempts INTEGER NOT NULL DEFAULT 0,
                worker_id TEXT,
                lease_token UUID,
                lease_until TIMESTAMPTZ,
                next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_error_code TEXT,
                row_version BIGINT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE media_upload_sessions (
                id UUID PRIMARY KEY,
                account_id TEXT NOT NULL,
                media_asset_id UUID NOT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE media_storage_cleanup_tasks (
                id UUID PRIMARY KEY,
                storage_key TEXT NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL,
                attempt_count INTEGER NOT NULL,
                next_attempt_at TIMESTAMPTZ NOT NULL
            );
            CREATE UNIQUE INDEX uq_media_storage_cleanup_active_key
                ON media_storage_cleanup_tasks (storage_key)
                WHERE status IN ('PENDING', 'RUNNING');
            """
        )
        yield TEST_DATABASE_URL
    finally:
        await connection.execute(
            """
            DROP TABLE IF EXISTS media_storage_cleanup_tasks;
            DROP TABLE IF EXISTS media_upload_sessions;
            DROP TABLE IF EXISTS media_validation_jobs;
            DROP TABLE IF EXISTS media_assets;
            """
        )
        await connection.close()


async def seed_job(database_url: str, *, attempts: int = 0) -> tuple[UUID, UUID]:
    asset_id = uuid4()
    job_id = uuid4()
    connection = await asyncpg.connect(database_url)
    try:
        await connection.execute(
            """
            INSERT INTO media_assets (id, account_id, status)
            VALUES ($1, 'media-test-account', 'VALIDATING')
            """,
            asset_id,
        )
        await connection.execute(
            """
            INSERT INTO media_upload_sessions (id, account_id, media_asset_id, status)
            VALUES ($1, 'media-test-account', $2, 'VALIDATING')
            """,
            uuid4(),
            asset_id,
        )
        await connection.execute(
            """
            INSERT INTO media_validation_jobs (
                id, account_id, media_asset_id, storage_key, declared_type,
                declared_content_type, expected_size_bytes, expected_sha256, attempts
            )
            VALUES ($1, 'media-test-account', $2, 'media/test-object', 'AUDIO',
                    'audio/mpeg', 1024, $3, $4)
            """,
            job_id,
            asset_id,
            "a" * 64,
            attempts,
        )
    finally:
        await connection.close()
    return job_id, asset_id


async def expire_claim(database_url: str, job_id: UUID) -> None:
    connection = await asyncpg.connect(database_url)
    try:
        await connection.execute(
            """
            UPDATE media_validation_jobs
               SET lease_until = CURRENT_TIMESTAMP - INTERVAL '1 minute'
             WHERE id = $1
            """,
            job_id,
        )
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_stale_worker_cannot_complete_after_lease_reclaim(media_database: str) -> None:
    job_id, asset_id = await seed_job(media_database)
    stale = MediaValidationRepository(media_database)
    replacement = MediaValidationRepository(media_database)
    await stale.connect()
    await replacement.connect()
    try:
        stale_job = await stale.claim_next("stale-worker")
        assert stale_job is not None
        await expire_claim(media_database, job_id)
        current_job = await replacement.claim_next("replacement-worker")
        assert current_job is not None
        assert current_job.lease_token != stale_job.lease_token
        assert current_job.row_version == stale_job.row_version + 1

        with pytest.raises(LeaseLostError):
            await stale.complete(stale_job, "stale-worker", status="READY")

        state = await replacement._require_pool().fetchrow(
            """
            SELECT j.status, j.worker_id, j.lease_token, a.status AS asset_status,
                   s.status AS session_status, COUNT(c.id) AS cleanup_count
              FROM media_validation_jobs j
              JOIN media_assets a ON a.id = j.media_asset_id
              JOIN media_upload_sessions s ON s.media_asset_id = a.id
              LEFT JOIN media_storage_cleanup_tasks c ON c.storage_key = j.storage_key
             WHERE j.id = $1
             GROUP BY j.status, j.worker_id, j.lease_token, a.status, s.status
            """,
            job_id,
        )
    finally:
        await stale.close()
        await replacement.close()

    assert state is not None
    assert state["status"] == "RUNNING"
    assert state["worker_id"] == "replacement-worker"
    assert state["lease_token"] == current_job.lease_token
    assert state["asset_status"] == "VALIDATING"
    assert state["session_status"] == "VALIDATING"
    assert state["cleanup_count"] == 0
    assert asset_id == current_job.media_asset_id


@pytest.mark.asyncio
async def test_complete_handles_production_varchar_asset_status(media_database: str) -> None:
    job_id, asset_id = await seed_job(media_database)
    repository = MediaValidationRepository(media_database)
    await repository.connect()
    try:
        claimed = await repository.claim_next("validation-worker")
        assert claimed is not None

        assert await repository.complete(
            claimed,
            "validation-worker",
            status="READY",
            detected_content_type="audio/mpeg",
            detected_container="mp3",
            detected_codec="mp3",
            duration_ms=1_000,
        )

        state = await repository._require_pool().fetchrow(
            """
            SELECT j.status, j.worker_id, j.lease_token,
                   a.status AS asset_status, a.checksum_verified_at,
                   s.status AS session_status
              FROM media_validation_jobs j
              JOIN media_assets a ON a.id = j.media_asset_id
              JOIN media_upload_sessions s ON s.media_asset_id = a.id
             WHERE j.id = $1
            """,
            job_id,
        )
    finally:
        await repository.close()

    assert state is not None
    assert state["status"] == "COMPLETED"
    assert state["worker_id"] is None
    assert state["lease_token"] is None
    assert state["asset_status"] == "READY"
    assert state["checksum_verified_at"] is not None
    assert state["session_status"] == "READY"
    assert asset_id == claimed.media_asset_id


@pytest.mark.asyncio
async def test_stale_worker_cannot_exhaust_retry_after_lease_reclaim(media_database: str) -> None:
    job_id, asset_id = await seed_job(media_database, attempts=2)
    stale = MediaValidationRepository(media_database)
    replacement = MediaValidationRepository(media_database)
    await stale.connect()
    await replacement.connect()
    try:
        stale_job = await stale.claim_next("stale-worker")
        assert stale_job is not None
        await expire_claim(media_database, job_id)
        current_job = await replacement.claim_next("replacement-worker")
        assert current_job is not None

        with pytest.raises(LeaseLostError):
            await stale.retry_or_fail(stale_job, "stale-worker", "TEST_FAILURE")

        state = await replacement._require_pool().fetchrow(
            """
            SELECT j.status, a.status AS asset_status, s.status AS session_status,
                   COUNT(c.id) AS cleanup_count
              FROM media_validation_jobs j
              JOIN media_assets a ON a.id = j.media_asset_id
              JOIN media_upload_sessions s ON s.media_asset_id = a.id
              LEFT JOIN media_storage_cleanup_tasks c ON c.storage_key = j.storage_key
             WHERE j.id = $1
             GROUP BY j.status, a.status, s.status
            """,
            job_id,
        )
    finally:
        await stale.close()
        await replacement.close()

    assert state is not None
    assert state["status"] == "RUNNING"
    assert state["asset_status"] == "VALIDATING"
    assert state["session_status"] == "VALIDATING"
    assert state["cleanup_count"] == 0
    assert asset_id == current_job.media_asset_id


@pytest.mark.asyncio
async def test_heartbeat_with_old_lease_token_fails(media_database: str) -> None:
    job_id, _ = await seed_job(media_database)
    repository = MediaValidationRepository(media_database)
    await repository.connect()
    try:
        claimed = await repository.claim_next("worker-a")
        assert claimed is not None
        assert not await repository.heartbeat(job_id, "worker-a", uuid4())
        assert await repository.heartbeat(job_id, "worker-a", claimed.lease_token)
    finally:
        await repository.close()
