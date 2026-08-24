from contextlib import asynccontextmanager
from uuid import UUID, uuid4

import pytest

from narrativex_worker.media_validation_repository import (
    ClaimedMediaValidationJob,
    MediaValidationRepository,
)


class _FakeConnection:
    def __init__(self, job: ClaimedMediaValidationJob) -> None:
        self.job = job
        self.executions: list[tuple[str, tuple[object, ...]]] = []

    @asynccontextmanager
    async def transaction(self):
        yield

    async def fetchrow(self, query: str, *args: object):
        if "UPDATE media_validation_jobs" in query:
            return {"media_asset_id": self.job.media_asset_id, "account_id": self.job.account_id}
        raise AssertionError(f"Unexpected fetchrow query: {query}")

    async def fetchval(self, query: str, *args: object):
        if "UPDATE media_assets" in query:
            return self.job.media_asset_id
        raise AssertionError(f"Unexpected fetchval query: {query}")

    async def execute(self, query: str, *args: object):
        self.executions.append((query, args))
        return "UPDATE 1"


class _FakePool:
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection

    @asynccontextmanager
    async def acquire(self):
        yield self.connection


def _job(*, attempts: int) -> ClaimedMediaValidationJob:
    return ClaimedMediaValidationJob(
        id=uuid4(),
        account_id="account-a",
        media_asset_id=uuid4(),
        storage_key="media/uploads/rejected",
        declared_type="AUDIO",
        declared_content_type="audio/mpeg",
        expected_size_bytes=128,
        expected_sha256="a" * 64,
        attempts=attempts,
        lease_token=uuid4(),
        row_version=1,
    )


def _cleanup_id(connection: _FakeConnection) -> UUID:
    matches = [
        args[0]
        for query, args in connection.executions
        if "INSERT INTO media_storage_cleanup_tasks" in query
    ]
    assert len(matches) == 1
    assert isinstance(matches[0], UUID)
    return matches[0]


@pytest.mark.asyncio
async def test_validation_rejection_creates_uuidv7_cleanup_task() -> None:
    job = _job(attempts=1)
    connection = _FakeConnection(job)
    repository = MediaValidationRepository("postgresql://unused")
    repository._pool = _FakePool(connection)  # type: ignore[assignment]

    await repository.complete(job, "worker-a", status="REJECTED")

    assert _cleanup_id(connection).version == 7


@pytest.mark.asyncio
async def test_retry_exhaustion_creates_uuidv7_cleanup_task() -> None:
    job = _job(attempts=3)
    connection = _FakeConnection(job)
    repository = MediaValidationRepository("postgresql://unused")
    repository._pool = _FakePool(connection)  # type: ignore[assignment]

    await repository.retry_or_fail(job, "worker-a", "BROKEN")

    assert _cleanup_id(connection).version == 7
