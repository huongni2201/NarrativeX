from typing import Any, cast
from uuid import UUID

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.image_generation_repository import (
    ClaimedImageGenerationJob,
    DurableImageOperation,
    ImageGenerationRepository,
)
from narrativex_worker.image_generation_repository.implementation import (
    ImageGenerationRepository as ImageGenerationRepositoryImplementation,
)
from narrativex_worker.schema import ProviderOperationStatus


class _Transaction:
    def __init__(self, connection: "_Connection") -> None:
        self.connection = connection

    async def __aenter__(self) -> "_Transaction":
        assert self.connection.transaction_active is False
        self.connection.transaction_active = True
        return self

    async def __aexit__(self, exception_type: object, exception: object, traceback: object) -> None:
        self.connection.transaction_active = False


class _Connection:
    def __init__(self) -> None:
        self.transaction_active = False
        self.fetchrow_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.execute_calls: list[tuple[str, tuple[Any, ...]]] = []

    def transaction(self) -> _Transaction:
        return _Transaction(self)

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        self.fetchrow_calls.append((query, args))
        if "UPDATE provider_operations" in query:
            return {"id": args[0]}
        raise AssertionError(f"Unexpected fetchrow query: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        self.execute_calls.append((query, args))
        if "UPDATE media_generation_items" in query:
            return "UPDATE 1"
        raise AssertionError(f"Unexpected execute query: {query}")


class _Acquire:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    async def __aenter__(self) -> _Connection:
        return self.connection

    async def __aexit__(self, exception_type: object, exception: object, traceback: object) -> None:
        return None


class _Pool:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def acquire(self) -> _Acquire:
        return _Acquire(self.connection)


def _repository(connection: _Connection) -> ImageGenerationRepository:
    repository = ImageGenerationRepository(
        "postgresql://unused",
        lease_seconds=30,
        settings=WorkerSettings(worker_env="test"),
    )
    repository._pool = cast(Any, _Pool(connection))
    return repository


def _operation() -> DurableImageOperation:
    return DurableImageOperation(
        id=20,
        stage_attempt_id=10,
        provider_key="vertex",
        request_fingerprint="a" * 64,
        provider_operation_id="provider-operation-20",
        status=ProviderOperationStatus.RUNNING,
        row_version=7,
        items=(),
        worker_id=None,
        lease_token=None,
    )


def _job() -> ClaimedImageGenerationJob:
    return ClaimedImageGenerationJob(
        generation_job_id=1,
        stage_attempt_id=10,
        lease_token="00000000-0000-0000-0000-000000000001",
        project_id=1,
        media_plan_id=UUID("00000000-0000-0000-0000-000000000002"),
        worker_id="worker-1",
    )


@pytest.mark.asyncio
async def test_provider_completion_aggregates_before_transaction_commits() -> None:
    connection = _Connection()
    repository = _repository(connection)
    aggregate_calls: list[int] = []

    async def aggregate(connection_arg: _Connection, stage_attempt_id: int) -> None:
        assert connection_arg is connection
        assert connection_arg.transaction_active is True
        aggregate_calls.append(stage_attempt_id)

    repository._aggregate_generation_job = cast(Any, aggregate)

    await repository.complete_provider_operation(_operation(), ())

    assert aggregate_calls == [10]
    assert connection.transaction_active is False
    query, _ = connection.fetchrow_calls[0]
    assert "RETURNING id" in query


@pytest.mark.asyncio
async def test_provider_failure_updates_items_and_aggregates_before_transaction_commits() -> None:
    connection = _Connection()
    repository = _repository(connection)
    aggregate_calls: list[int] = []

    async def aggregate(connection_arg: _Connection, stage_attempt_id: int) -> None:
        assert connection_arg is connection
        assert connection_arg.transaction_active is True
        aggregate_calls.append(stage_attempt_id)

    repository._aggregate_generation_job = cast(Any, aggregate)

    transitioned = await repository.fail_provider_operation(_operation(), "HTTP_400")

    assert transitioned is True
    assert aggregate_calls == [10]
    assert connection.transaction_active is False
    assert len(connection.execute_calls) == 1
    assert "UPDATE media_generation_items" in connection.execute_calls[0][0]


@pytest.mark.asyncio
async def test_reclaimed_job_without_pending_items_reaggregates_instead_of_silent_return(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = _Connection()
    repository = _repository(connection)
    aggregate_calls: list[int] = []

    async def no_pending(
        self: ImageGenerationRepositoryImplementation,
        job: ClaimedImageGenerationJob,
    ) -> tuple[Any, ...]:
        del self, job
        return ()

    async def aggregate(stage_attempt_id: int) -> None:
        aggregate_calls.append(stage_attempt_id)

    monkeypatch.setattr(ImageGenerationRepositoryImplementation, "load_pending_items", no_pending)
    repository.aggregate_generation_job = cast(Any, aggregate)

    pending = await repository.load_pending_items(_job())

    assert pending == ()
    assert aggregate_calls == [10]
