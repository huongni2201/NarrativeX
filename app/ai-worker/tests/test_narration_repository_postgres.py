import asyncio
import os
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import asyncpg  # type: ignore[import-untyped]
import pytest

from narrativex_worker.narration.repository import (
    ClaimedNarrationJob,
    NarrationProviderStateConflictError,
    NarrationWorkerRepository,
)
from narrativex_worker.runtime.retry_policy import NARRATION_STAGE_RETRY_POLICY
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
            DROP TABLE IF EXISTS media_assets;
            DROP TABLE IF EXISTS voice_reference_assets;
            DROP TABLE IF EXISTS voice_catalog;
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
                request_fingerprint TEXT NOT NULL UNIQUE,
                project_voice_reference_asset_id UUID,
                account_voice_reference_asset_id UUID
            );
            CREATE TABLE media_assets (
                id UUID PRIMARY KEY,
                project_id BIGINT,
                storage_key TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'READY',
                content_type TEXT NOT NULL DEFAULT 'audio/wav',
                size_bytes BIGINT NOT NULL DEFAULT 1,
                sha256 TEXT NOT NULL DEFAULT repeat('a', 64)
            );
            CREATE TABLE voice_reference_assets (
                id UUID PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'READY',
                storage_key TEXT,
                content_type TEXT,
                size_bytes BIGINT,
                sha256 TEXT
            );
            CREATE TABLE voice_catalog (
                id TEXT PRIMARY KEY,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                metadata_json JSONB
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
            DROP TABLE IF EXISTS media_assets;
            DROP TABLE IF EXISTS voice_reference_assets;
            DROP TABLE IF EXISTS voice_catalog;
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


async def seed_normal_candidate(database_url: str) -> tuple[int, int]:
    connection = await asyncpg.connect(database_url)
    try:
        job_id = await connection.fetchval(
            "INSERT INTO generation_jobs (job_id) VALUES ($1) RETURNING id",
            f"job-{uuid.uuid4()}",
        )
        stage_id = await connection.fetchval(
            "INSERT INTO stage_attempts (generation_job_id) VALUES ($1) RETURNING id", job_id
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
        return int(stage_id), int(job_id)
    finally:
        await connection.close()


async def wait_for_claim_parent_lock(
    connection: asyncpg.Connection,
    claim_task: asyncio.Task[ClaimedNarrationJob | None],
) -> None:
    deadline = asyncio.get_running_loop().time() + 5
    while asyncio.get_running_loop().time() < deadline:
        if claim_task.done():
            raise AssertionError(f"claim finished before parent lock: {claim_task.result()!r}")
        waiting = await connection.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                  FROM pg_stat_activity
                 WHERE pid <> pg_backend_pid()
                   AND datname = current_database()
                   AND state = 'active'
                   AND cardinality(pg_blocking_pids(pid)) > 0
                   AND query ILIKE '%generation_jobs%'
            )
            """
        )
        if waiting:
            return
        await asyncio.sleep(0.01)
    raise AssertionError("claim did not reach the parent CAS lock")


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
async def test_normal_claim_cannot_resurrect_parent_canceled_during_claim(
    narration_provider_database: str,
) -> None:
    stage_id, job_id = await seed_normal_candidate(narration_provider_database)
    lock_connection = await asyncpg.connect(narration_provider_database)
    transaction = lock_connection.transaction()
    await transaction.start()
    await lock_connection.execute(
        """
        UPDATE generation_jobs
           SET status = 'CANCELED', row_version = row_version + 1
         WHERE id = $1
        """,
        job_id,
    )

    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    claim_task = asyncio.create_task(repository.claim_next("worker-b"))
    try:
        await wait_for_claim_parent_lock(lock_connection, claim_task)
        await transaction.commit()
        assert await claim_task is None
    finally:
        if not claim_task.done():
            claim_task.cancel()
            await asyncio.gather(claim_task, return_exceptions=True)
        await repository.close()
        await lock_connection.close()

    connection = await asyncpg.connect(narration_provider_database)
    try:
        stage_status, worker_id, current_job_status = await connection.fetchrow(
            """
            SELECT sa.status AS stage_status, sa.worker_id,
                   gj.status AS current_job_status
              FROM stage_attempts sa
              JOIN generation_jobs gj ON gj.id = sa.generation_job_id
             WHERE sa.id = $1
            """,
            stage_id,
        )
    finally:
        await connection.close()
    assert stage_status == "QUEUED"
    assert worker_id is None
    assert current_job_status == "CANCELED"


@pytest.mark.asyncio
async def test_normal_claim_rejects_parent_version_change_without_status_change(
    narration_provider_database: str,
) -> None:
    stage_id, job_id = await seed_normal_candidate(narration_provider_database)
    lock_connection = await asyncpg.connect(narration_provider_database)
    transaction = lock_connection.transaction()
    await transaction.start()
    await lock_connection.execute(
        """
        UPDATE generation_jobs
           SET progress = 25, row_version = row_version + 1
         WHERE id = $1
        """,
        job_id,
    )

    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    claim_task = asyncio.create_task(repository.claim_next("worker-b"))
    try:
        await wait_for_claim_parent_lock(lock_connection, claim_task)
        await transaction.commit()
        assert await claim_task is None
    finally:
        if not claim_task.done():
            claim_task.cancel()
            await asyncio.gather(claim_task, return_exceptions=True)
        await repository.close()
        await lock_connection.close()

    connection = await asyncpg.connect(narration_provider_database)
    try:
        stage_status, job_status, progress = await connection.fetchrow(
            """
            SELECT sa.status AS stage_status, gj.status AS job_status, gj.progress
              FROM stage_attempts sa
              JOIN generation_jobs gj ON gj.id = sa.generation_job_id
             WHERE sa.id = $1
            """,
            stage_id,
        )
    finally:
        await connection.close()
    assert stage_status == "QUEUED"
    assert job_status == "QUEUED"
    assert progress == 25


@pytest.mark.asyncio
async def test_reconciliation_claim_cannot_start_stage_after_parent_cancellation(
    narration_provider_database: str,
) -> None:
    stage_id, job_id, _ = await seed_reconciliation_candidate(
        narration_provider_database,
        next_reconcile_at=datetime.now(UTC) - timedelta(seconds=1),
    )
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        snapshot_connection = await asyncpg.connect(narration_provider_database)
        try:
            snapshot = await snapshot_connection.fetchrow(
                """
                SELECT sa.id AS stage_attempt_id,
                       sa.status AS stage_attempt_status,
                       sa.row_version AS stage_attempt_row_version,
                       gj.id AS generation_job_id,
                       gj.status AS generation_job_status,
                       gj.row_version AS generation_job_row_version,
                       gj.job_id,
                       nr.id AS narration_request_id,
                       nr.project_id,
                       nr.chapter_id,
                       nr.chapter_row_version,
                       nr.source_hash,
                       nr.source_text,
                       nr.voice_id,
                       nr.language,
                       nr.speaking_rate,
                       nr.request_fingerprint
                  FROM provider_operations po
                  JOIN stage_attempts sa ON sa.id = po.stage_attempt_id
                  JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                  JOIN narration_operations no ON no.stage_attempt_id = sa.id
                  JOIN narration_requests nr ON nr.id = no.narration_request_id
                 WHERE sa.id = $1
                """,
                stage_id,
            )
            assert snapshot is not None
            await snapshot_connection.execute(
                """
                UPDATE generation_jobs
                   SET status = 'CANCELED', row_version = row_version + 1
                 WHERE id = $1
                """,
                job_id,
            )
        finally:
            await snapshot_connection.close()

        pool = repository._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                claimed = await repository._claim_candidate(
                    connection,
                    snapshot,
                    "worker-b",
                    current_step="NARRATION_TTS_RECONCILE",
                )
        assert claimed is None
    finally:
        await repository.close()

    connection = await asyncpg.connect(narration_provider_database)
    try:
        stage_status, worker_id, current_job_status = await connection.fetchrow(
            """
            SELECT sa.status AS stage_status, sa.worker_id,
                   gj.status AS current_job_status
              FROM stage_attempts sa
              JOIN generation_jobs gj ON gj.id = sa.generation_job_id
             WHERE sa.id = $1
            """,
            stage_id,
        )
    finally:
        await connection.close()
    assert stage_status == "UNKNOWN"
    assert worker_id is None
    assert current_job_status == "CANCELED"


@pytest.mark.asyncio
async def test_stale_running_narration_lease_is_recovered(
    narration_provider_database: str,
) -> None:
    stage_id, job_id = await seed_normal_candidate(narration_provider_database)
    connection = await asyncpg.connect(narration_provider_database)
    try:
        await connection.execute(
            "UPDATE generation_jobs SET status = 'RUNNING' WHERE id = $1",
            job_id,
        )
        await connection.execute(
            """
            UPDATE stage_attempts
               SET status = 'RUNNING', worker_id = 'dead-worker',
                   heartbeat_at = CURRENT_TIMESTAMP - INTERVAL '5 minutes'
             WHERE id = $1
            """,
            stage_id,
        )
    finally:
        await connection.close()

    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        assert await repository.claim_next("replacement-worker") is not None
    finally:
        await repository.close()

    connection = await asyncpg.connect(narration_provider_database)
    try:
        stage_status, worker_id, job_status = await connection.fetchrow(
            """
            SELECT sa.status AS stage_status, sa.worker_id, gj.status AS job_status
              FROM stage_attempts sa
              JOIN generation_jobs gj ON gj.id = sa.generation_job_id
             WHERE sa.id = $1
            """,
            stage_id,
        )
    finally:
        await connection.close()
    assert stage_status == "RUNNING"
    assert worker_id == "replacement-worker"
    assert job_status == "RUNNING"


@pytest.mark.asyncio
async def test_retryable_narration_failure_is_not_claimed_before_backoff(
    narration_provider_database: str,
) -> None:
    stage_id, job_id = await seed_normal_candidate(narration_provider_database)
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        claimed = await repository.claim_next("worker-a")
        assert claimed is not None
        assert await repository.mark_stalled(
            claimed,
            "worker-a",
            "NARRATION_RETRYABLE",
        )
        assert await repository.claim_next("worker-b") is None

        connection = await asyncpg.connect(narration_provider_database)
        try:
            await connection.execute(
                """
                UPDATE stage_attempts
                   SET updated_at = CURRENT_TIMESTAMP - ($2 * INTERVAL '1 second')
                 WHERE id = $1
                """,
                stage_id,
                NARRATION_STAGE_RETRY_POLICY.max_delay_seconds,
            )
        finally:
            await connection.close()

        retry_claim = await repository.claim_next("worker-b")
    finally:
        await repository.close()

    assert retry_claim is not None
    assert retry_claim.stage_attempt_id == stage_id

    connection = await asyncpg.connect(narration_provider_database)
    try:
        attempt_number = await connection.fetchval(
            "SELECT attempt_number FROM stage_attempts WHERE id = $1", stage_id
        )
        assert (
            await connection.fetchval("SELECT status FROM generation_jobs WHERE id = $1", job_id)
            == "RUNNING"
        )
    finally:
        await connection.close()
    assert attempt_number == 2


@pytest.mark.asyncio
async def test_exhausted_narration_retries_fail_stage_and_job(
    narration_provider_database: str,
) -> None:
    stage_id, job_id = await seed_normal_candidate(narration_provider_database)
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        for worker_id in ("worker-a", "worker-b", "worker-c"):
            claimed = await repository.claim_next(worker_id)
            assert claimed is not None
            assert await repository.mark_stalled(
                claimed,
                worker_id,
                "NARRATION_RETRYABLE",
            )
            if worker_id != "worker-c":
                connection = await asyncpg.connect(narration_provider_database)
                try:
                    await connection.execute(
                        """
                        UPDATE stage_attempts
                           SET updated_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'
                         WHERE id = $1
                        """,
                        stage_id,
                    )
                finally:
                    await connection.close()
    finally:
        await repository.close()

    connection = await asyncpg.connect(narration_provider_database)
    try:
        stage_status, job_status = await connection.fetchrow(
            """
            SELECT sa.status, gj.status
              FROM stage_attempts sa
              JOIN generation_jobs gj ON gj.id = sa.generation_job_id
             WHERE sa.id = $1 AND gj.id = $2
            """,
            stage_id,
            job_id,
        )
    finally:
        await connection.close()
    assert stage_status == "FAILED"
    assert job_status == "FAILED"


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
async def test_segment_provider_operation_is_idempotent_and_result_is_durable(
    narration_provider_database: str,
) -> None:
    stage_id = await seed_stage(narration_provider_database)
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        first = await repository.reserve_provider_operation(
            stage_id, "vieneu-tts", "fingerprint"
        )
        duplicate = await repository.reserve_provider_operation(
            stage_id, "vieneu-tts", "fingerprint"
        )
        assert first.id == duplicate.id
        assert first.created is True
        assert duplicate.created is False

        unknown = await repository.fence_submission_unknown(first)
        assert unknown.next_reconcile_at is not None
        assert unknown.reconcile_attempts == 0
        result = {
            "storageKey": "narration/request/segments/0000.pcm",
            "checksum": "a" * 64,
            "sizeBytes": 100,
            "durationMs": 1000,
            "sampleRateHz": 48000,
            "channels": 1,
        }
        completed = await repository.complete_provider_operation(unknown, result)
        replay = await repository.complete_provider_operation(completed, result)
    finally:
        await repository.close()

    assert completed.status is ProviderOperationStatus.COMPLETED
    assert replay.id == completed.id
    assert replay.result == result
    assert replay.result_fingerprint is not None


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
            first_stage_id, "vieneu-tts", "same-logical-request"
        )
        retry = await repository.reserve_provider_operation(
            second_stage_id, "vieneu-tts", "same-logical-request"
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
            stage_id, "vieneu-tts", "reconcile-cas"
        )
        unknown = await repository.fence_submission_unknown(reserved)
        scheduled = await repository.schedule_provider_reconciliation(
            unknown, error="temporary local storage timeout"
        )
        with pytest.raises(NarrationProviderStateConflictError):
            await repository.schedule_provider_reconciliation(unknown, error="stale worker update")
    finally:
        await repository.close()

    assert scheduled.reconcile_attempts == 1
    assert scheduled.next_reconcile_at is not None
    assert scheduled.last_reconcile_error == "temporary local storage timeout"


@pytest.mark.asyncio
async def test_completed_segment_result_cannot_be_overwritten(
    narration_provider_database: str,
) -> None:
    stage_id = await seed_stage(narration_provider_database)
    repository = NarrationWorkerRepository(narration_provider_database, lease_seconds=30)
    await repository.connect()
    try:
        reserved = await repository.reserve_provider_operation(
            stage_id, "vieneu-tts", "immutable"
        )
        unknown = await repository.fence_submission_unknown(reserved)
        completed = await repository.complete_provider_operation(
            unknown,
            {"storageKey": "a", "checksum": "a" * 64},
        )
        with pytest.raises(NarrationProviderStateConflictError):
            await repository.complete_provider_operation(
                completed,
                {"storageKey": "b", "checksum": "b" * 64},
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
