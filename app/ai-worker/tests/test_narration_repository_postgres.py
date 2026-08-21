import os
import uuid
from collections.abc import AsyncIterator

import asyncpg  # type: ignore[import-untyped]
import pytest

from narrativex_worker.narration.pricing import GoogleTtsPricingCatalog
from narrativex_worker.narration.repository import (
    ClaimedNarrationJob,
    NarrationProviderStateConflictError,
    NarrationWorkerRepository,
)
from narrativex_worker.schema import ProviderOperationStatus

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL is required for PostgreSQL integration tests",
)


@pytest.fixture
async def narration_provider_database() -> AsyncIterator[str]:
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
                status TEXT NOT NULL DEFAULT 'QUEUED',
                current_step TEXT,
                error_code TEXT,
                row_version BIGINT NOT NULL DEFAULT 0
            );
            CREATE TABLE stage_attempts (
                id BIGSERIAL PRIMARY KEY,
                generation_job_id BIGINT NOT NULL REFERENCES generation_jobs(id),
                status TEXT NOT NULL DEFAULT 'QUEUED',
                worker_id TEXT,
                row_version BIGINT NOT NULL DEFAULT 0
            );
            CREATE TABLE provider_operations (
                id BIGSERIAL PRIMARY KEY,
                row_version BIGINT NOT NULL DEFAULT 0,
                stage_attempt_id BIGINT NOT NULL REFERENCES stage_attempts(id),
                provider_key TEXT NOT NULL,
                provider_operation_id TEXT,
                status TEXT NOT NULL,
                reserved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMPTZ,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                request_fingerprint TEXT NOT NULL,
                normalized_result_json JSONB,
                result_fingerprint TEXT,
                actual_cost NUMERIC(19, 9),
                billing_currency TEXT,
                usage_json JSONB,
                pricing_snapshot_json JSONB,
                next_reconcile_at TIMESTAMPTZ,
                reconcile_attempts INTEGER NOT NULL DEFAULT 0,
                last_reconcile_error TEXT,
                UNIQUE (provider_key, request_fingerprint)
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


async def seed_stage(database_url: str) -> int:
    connection = await asyncpg.connect(database_url)
    try:
        job_id = await connection.fetchval(
            "INSERT INTO generation_jobs DEFAULT VALUES RETURNING id"
        )
        stage_id = await connection.fetchval(
            "INSERT INTO stage_attempts (generation_job_id) VALUES ($1) RETURNING id", job_id
        )
        return int(stage_id)
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_segment_provider_operation_is_idempotent_and_billing_is_snapshotted(
    narration_provider_database: str,
) -> None:
    stage_id = await seed_stage(narration_provider_database)
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        first = await repository.reserve_provider_operation(
            stage_id, "google-cloud-tts", "fingerprint"
        )
        duplicate = await repository.reserve_provider_operation(
            stage_id, "google-cloud-tts", "fingerprint"
        )
        assert first.id == duplicate.id
        assert first.created is True
        assert duplicate.created is False

        unknown = await repository.fence_submission_unknown(first)
        assert unknown.next_reconcile_at is not None
        assert unknown.reconcile_attempts == 0
        pricing = GoogleTtsPricingCatalog("google-tts-2026-08-20").resolve(
            "vi-VN-Chirp3-HD-Achernar"
        )
        result = {
            "storageKey": "narration/request/segments/0000.pcm",
            "checksum": "a" * 64,
            "sizeBytes": 100,
            "durationMs": 1000,
            "sampleRateHz": 48000,
            "channels": 1,
        }
        completed = await repository.complete_provider_operation(
            unknown, result, character_count=2000, pricing=pricing
        )
        replay = await repository.complete_provider_operation(
            completed, result, character_count=2000, pricing=pricing
        )
    finally:
        await repository.close()

    assert completed.status is ProviderOperationStatus.COMPLETED
    assert replay.id == completed.id

    connection = await asyncpg.connect(narration_provider_database)
    try:
        row = await connection.fetchrow(
            """
            SELECT actual_cost, billing_currency, usage_json, pricing_snapshot_json
              FROM provider_operations
             WHERE id = $1
            """,
            completed.id,
        )
    finally:
        await connection.close()
    assert row is not None
    assert str(row["actual_cost"]) == "0.060000000"
    assert row["billing_currency"] == "USD"
    assert row["usage_json"] is not None
    assert row["pricing_snapshot_json"] is not None


@pytest.mark.asyncio
async def test_provider_operation_is_reused_by_a_retry_stage(
    narration_provider_database: str,
) -> None:
    first_stage_id = await seed_stage(narration_provider_database)
    second_stage_id = await seed_stage(narration_provider_database)
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        first = await repository.reserve_provider_operation(
            first_stage_id, "google-cloud-tts", "same-logical-request"
        )
        retry = await repository.reserve_provider_operation(
            second_stage_id, "google-cloud-tts", "same-logical-request"
        )
    finally:
        await repository.close()

    assert retry.id == first.id
    assert retry.stage_attempt_id == first.stage_attempt_id
    assert retry.created is False


@pytest.mark.asyncio
async def test_reconciliation_backoff_update_is_cas_fenced(
    narration_provider_database: str,
) -> None:
    stage_id = await seed_stage(narration_provider_database)
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        reserved = await repository.reserve_provider_operation(
            stage_id, "google-cloud-tts", "reconcile-cas"
        )
        unknown = await repository.fence_submission_unknown(reserved)
        scheduled = await repository.schedule_provider_reconciliation(
            unknown, error="temporary R2 timeout"
        )
        with pytest.raises(NarrationProviderStateConflictError):
            await repository.schedule_provider_reconciliation(unknown, error="stale worker update")
    finally:
        await repository.close()

    assert scheduled.reconcile_attempts == 1
    assert scheduled.next_reconcile_at is not None
    assert scheduled.last_reconcile_error == "temporary R2 timeout"


@pytest.mark.asyncio
async def test_completed_segment_result_cannot_be_overwritten(
    narration_provider_database: str,
) -> None:
    stage_id = await seed_stage(narration_provider_database)
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    pricing = GoogleTtsPricingCatalog("v1").resolve("en-US-Neural2-A")
    try:
        reserved = await repository.reserve_provider_operation(
            stage_id, "google-cloud-tts", "immutable"
        )
        unknown = await repository.fence_submission_unknown(reserved)
        completed = await repository.complete_provider_operation(
            unknown,
            {"storageKey": "a", "checksum": "a" * 64},
            character_count=10,
            pricing=pricing,
        )
        with pytest.raises(NarrationProviderStateConflictError):
            await repository.complete_provider_operation(
                completed,
                {"storageKey": "b", "checksum": "b" * 64},
                character_count=10,
                pricing=pricing,
            )
    finally:
        await repository.close()


@pytest.mark.asyncio
async def test_mark_unknown_requires_owned_running_stage(
    narration_provider_database: str,
) -> None:
    stage_id = await seed_stage(narration_provider_database)
    connection = await asyncpg.connect(narration_provider_database)
    try:
        job_id = await connection.fetchval(
            "SELECT generation_job_id FROM stage_attempts WHERE id = $1", stage_id
        )
        await connection.execute(
            "UPDATE generation_jobs SET status = 'RUNNING' WHERE id = $1", job_id
        )
        await connection.execute(
            "UPDATE stage_attempts SET status = 'RUNNING', worker_id = 'worker-a' WHERE id = $1",
            stage_id,
        )
    finally:
        await connection.close()

    claimed = ClaimedNarrationJob(
        stage_attempt_id=stage_id,
        generation_job_id=int(job_id),
        job_id="job",
        narration_request_id=uuid.uuid4(),
        project_id=1,
        chapter_id=1,
        chapter_row_version=1,
        source_hash="a" * 64,
        source_text="text",
        voice_id="voice",
        language="en-US",
        speaking_rate=1.0,
        request_fingerprint="request",
    )
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        assert await repository.mark_unknown(claimed, "worker-b") is False
        assert await repository.mark_unknown(claimed, "worker-a") is True
    finally:
        await repository.close()

    connection = await asyncpg.connect(narration_provider_database)
    try:
        stage_status, job_status = await connection.fetchrow(
            """
            SELECT sa.status AS stage_status, gj.status AS job_status
              FROM stage_attempts sa
              JOIN generation_jobs gj ON gj.id = sa.generation_job_id
             WHERE sa.id = $1
            """,
            stage_id,
        )
    finally:
        await connection.close()
    assert stage_status == "UNKNOWN"
    assert job_status == "UNKNOWN"
