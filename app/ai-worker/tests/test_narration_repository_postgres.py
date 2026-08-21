import os
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

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
            DROP TABLE IF EXISTS narration_operations;
            DROP TABLE IF EXISTS narration_requests;
            DROP TABLE IF EXISTS provider_operations;
            DROP TABLE IF EXISTS stage_attempts;
            DROP TABLE IF EXISTS generation_jobs;

            CREATE TABLE generation_jobs (
                id BIGSERIAL PRIMARY KEY,
                job_id TEXT NOT NULL UNIQUE,
                job_type TEXT NOT NULL DEFAULT 'NARRATION_GENERATE',
                status TEXT NOT NULL DEFAULT 'QUEUED',
                progress INTEGER NOT NULL DEFAULT 0,
                current_step TEXT,
                error_code TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                row_version BIGINT NOT NULL DEFAULT 0
            );
            CREATE TABLE stage_attempts (
                id BIGSERIAL PRIMARY KEY,
                generation_job_id BIGINT NOT NULL REFERENCES generation_jobs(id),
                stage_name TEXT NOT NULL DEFAULT 'NARRATION_TTS',
                attempt_number INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'QUEUED',
                worker_id TEXT,
                heartbeat_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                row_version BIGINT NOT NULL DEFAULT 0
            );
            CREATE TABLE narration_requests (
                id UUID PRIMARY KEY,
                project_id BIGINT NOT NULL DEFAULT 1,
                chapter_id BIGINT NOT NULL DEFAULT 1,
                chapter_row_version BIGINT NOT NULL DEFAULT 1,
                source_hash TEXT NOT NULL DEFAULT repeat('a', 64),
                source_text TEXT NOT NULL DEFAULT 'hello',
                voice_id TEXT NOT NULL DEFAULT 'voice',
                language TEXT NOT NULL DEFAULT 'en-US',
                speaking_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                request_fingerprint TEXT NOT NULL UNIQUE
            );
            CREATE TABLE narration_operations (
                stage_attempt_id BIGINT PRIMARY KEY REFERENCES stage_attempts(id),
                narration_request_id UUID NOT NULL REFERENCES narration_requests(id)
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
            DROP TABLE IF EXISTS narration_operations;
            DROP TABLE IF EXISTS narration_requests;
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
            "INSERT INTO generation_jobs (job_id) VALUES ($1) RETURNING id",
            f"job-{uuid.uuid4()}",
        )
        stage_id = await connection.fetchval(
            "INSERT INTO stage_attempts (generation_job_id) VALUES ($1) RETURNING id", job_id
        )
        return int(stage_id)
    finally:
        await connection.close()


async def seed_reconciliation_candidate(
    database_url: str,
    *,
    next_reconcile_at: datetime | None,
) -> tuple[int, int, int]:
    connection = await asyncpg.connect(database_url)
    try:
        job_id = await connection.fetchval(
            """
            INSERT INTO generation_jobs (job_id, status, progress)
            VALUES ($1, 'UNKNOWN', 5)
            RETURNING id
            """,
            f"job-{uuid.uuid4()}",
        )
        stage_id = await connection.fetchval(
            """
            INSERT INTO stage_attempts (generation_job_id, status, worker_id)
            VALUES ($1, 'UNKNOWN', NULL)
            RETURNING id
            """,
            job_id,
        )
        request_id = uuid.uuid4()
        await connection.execute(
            "INSERT INTO narration_requests (id, request_fingerprint) VALUES ($1, $2)",
            request_id,
            f"request-{uuid.uuid4()}",
        )
        await connection.execute(
            """
            INSERT INTO narration_operations (stage_attempt_id, narration_request_id)
            VALUES ($1, $2)
            """,
            stage_id,
            request_id,
        )
        operation_id = await connection.fetchval(
            """
            INSERT INTO provider_operations
                (stage_attempt_id, provider_key, request_fingerprint, status, next_reconcile_at)
            VALUES ($1, 'google-cloud-tts', $2, 'UNKNOWN', $3)
            RETURNING id
            """,
            stage_id,
            f"reconcile-{uuid.uuid4()}",
            next_reconcile_at,
        )
        return int(stage_id), int(job_id), int(operation_id)
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_due_reconciliation_is_claimed(
    narration_provider_database: str,
) -> None:
    stage_id, job_id, operation_id = await seed_reconciliation_candidate(
        narration_provider_database,
        next_reconcile_at=datetime.now(UTC) - timedelta(seconds=1),
    )
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        claimed = await repository.claim_due_reconciliation("worker-a")
    finally:
        await repository.close()

    assert claimed is not None
    assert claimed.stage_attempt_id == stage_id
    assert claimed.generation_job_id == job_id

    connection = await asyncpg.connect(narration_provider_database)
    try:
        stage_status, job_status, operation_status = await connection.fetchrow(
            """
            SELECT sa.status AS stage_status, gj.status AS job_status, po.status AS operation_status
              FROM stage_attempts sa
              JOIN generation_jobs gj ON gj.id = sa.generation_job_id
              JOIN provider_operations po ON po.id = $1
             WHERE sa.id = $2
            """,
            operation_id,
            stage_id,
        )
    finally:
        await connection.close()
    assert stage_status == "RUNNING"
    assert job_status == "RUNNING"
    assert operation_status == "UNKNOWN"


@pytest.mark.asyncio
async def test_due_reconciliation_skip_locked_between_two_workers(
    narration_provider_database: str,
) -> None:
    stage_id, _, _ = await seed_reconciliation_candidate(
        narration_provider_database,
        next_reconcile_at=datetime.now(UTC) - timedelta(seconds=1),
    )
    lock_connection = await asyncpg.connect(narration_provider_database)
    transaction = lock_connection.transaction()
    await transaction.start()
    await lock_connection.fetchrow(
        "SELECT id FROM stage_attempts WHERE id = $1 FOR UPDATE", stage_id
    )

    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        assert await repository.claim_due_reconciliation("worker-b") is None
    finally:
        await repository.close()
        await transaction.rollback()
        await lock_connection.close()

    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        assert await repository.claim_due_reconciliation("worker-b") is not None
    finally:
        await repository.close()


@pytest.mark.asyncio
async def test_future_reconciliation_is_not_claimed(
    narration_provider_database: str,
) -> None:
    await seed_reconciliation_candidate(
        narration_provider_database,
        next_reconcile_at=datetime.now(UTC) + timedelta(minutes=5),
    )
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        assert await repository.claim_due_reconciliation("worker-a") is None
    finally:
        await repository.close()


@pytest.mark.asyncio
async def test_exhausted_operation_is_not_claimed(
    narration_provider_database: str,
) -> None:
    await seed_reconciliation_candidate(
        narration_provider_database,
        next_reconcile_at=None,
    )
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        assert await repository.claim_due_reconciliation("worker-a") is None
    finally:
        await repository.close()


@pytest.mark.asyncio
async def test_reconciliation_exhaustion_surfaces_manual_attention(
    narration_provider_database: str,
) -> None:
    stage_id, job_id, _ = await seed_reconciliation_candidate(
        narration_provider_database,
        next_reconcile_at=None,
    )
    connection = await asyncpg.connect(narration_provider_database)
    try:
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
        generation_job_id=job_id,
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
        assert (
            await repository.mark_reconciliation_exhausted(
                claimed, "worker-a", "RECONCILIATION_EXHAUSTED"
            )
            is True
        )
    finally:
        await repository.close()

    connection = await asyncpg.connect(narration_provider_database)
    try:
        stage_status, job_status, current_step = await connection.fetchrow(
            """
            SELECT sa.status AS stage_status, gj.status AS job_status, gj.current_step
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
    assert current_step == "NARRATION_REQUIRES_ATTENTION"


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
