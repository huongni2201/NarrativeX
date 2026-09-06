"""PostgreSQL regression coverage for durable chapter-analysis checkpoints."""

import os
import uuid
from collections.abc import AsyncIterator

import asyncpg  # type: ignore[import-untyped]
import pytest

from narrativex_worker.repository.analysis_checkpoints import (
    AnalysisCheckpointRepository,
    AnalysisCheckpointStatus,
)

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL is required for PostgreSQL integration tests",
)


@pytest.fixture
async def checkpoint_pool() -> AsyncIterator[asyncpg.Pool]:
    assert TEST_DATABASE_URL is not None
    schema = f"test_analysis_checkpoints_{uuid.uuid4().hex}"
    admin = await asyncpg.connect(TEST_DATABASE_URL)
    await admin.execute(f'CREATE SCHEMA "{schema}"')
    pool = await asyncpg.create_pool(
        TEST_DATABASE_URL,
        server_settings={"search_path": schema},
    )
    try:
        await pool.execute(
            """
            CREATE TABLE generation_jobs (
                id UUID PRIMARY KEY
            );

            CREATE TABLE stage_attempts (
                id UUID PRIMARY KEY,
                generation_job_id UUID NOT NULL REFERENCES generation_jobs(id),
                worker_id VARCHAR(128),
                status VARCHAR(32) NOT NULL
            );

            CREATE TABLE analysis_checkpoints (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                generation_job_id UUID NOT NULL REFERENCES generation_jobs(id),
                stage_attempt_id UUID NOT NULL REFERENCES stage_attempts(id),
                step_key VARCHAR(160) NOT NULL,
                input_fingerprint VARCHAR(64) NOT NULL,
                claim_owner VARCHAR(128) NOT NULL,
                lease_version BIGINT NOT NULL DEFAULT 1,
                status VARCHAR(16) NOT NULL,
                result_json JSONB,
                result_hash VARCHAR(64),
                provider_operation_id UUID,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                row_version BIGINT NOT NULL DEFAULT 0,
                UNIQUE (generation_job_id, step_key, input_fingerprint)
            );
            """
        )
        yield pool
    finally:
        await pool.close()
        await admin.execute(f'DROP SCHEMA "{schema}" CASCADE')
        await admin.close()


@pytest.mark.asyncio
async def test_claim_prepares_when_owner_is_used_for_insert_and_lease_check(
    checkpoint_pool: asyncpg.Pool,
) -> None:
    generation_job_id = uuid.uuid4()
    stage_attempt_id = uuid.uuid4()
    claim_owner = "worker-a:claim-1"
    async with checkpoint_pool.acquire() as connection:
        await connection.execute(
            "INSERT INTO generation_jobs (id) VALUES ($1)",
            generation_job_id,
        )
        await connection.execute(
            """
            INSERT INTO stage_attempts
                (id, generation_job_id, worker_id, status)
            VALUES ($1, $2, $3, 'RUNNING')
            """,
            stage_attempt_id,
            generation_job_id,
            claim_owner,
        )

    checkpoint = await AnalysisCheckpointRepository(checkpoint_pool).claim(
        stage_attempt_id=stage_attempt_id,
        step_key="structure",
        input_fingerprint="a" * 64,
        claim_owner=claim_owner,
    )

    assert checkpoint.generation_job_id == generation_job_id
    assert checkpoint.claim_owner == claim_owner
    assert checkpoint.status is AnalysisCheckpointStatus.RESERVED
