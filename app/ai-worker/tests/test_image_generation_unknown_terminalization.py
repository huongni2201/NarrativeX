from typing import Any, cast

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.image_generation_repository import (
    DurableImageOperation,
    ImageGenerationRepository,
)
from narrativex_worker.schema import ProviderOperationStatus


class _Transaction:
    async def __aenter__(self) -> "_Transaction":
        return self

    async def __aexit__(self, exception_type: object, exception: object, traceback: object) -> None:
        return None


class _Connection:
    def __init__(self, returned_status: str | None) -> None:
        self.returned_status = returned_status
        self.fetchrow_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.execute_calls: list[tuple[str, tuple[Any, ...]]] = []

    def transaction(self) -> _Transaction:
        return _Transaction()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, str] | None:
        self.fetchrow_calls.append((query, args))
        if self.returned_status is None:
            return None
        return {"status": self.returned_status}

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


def _operation(
    *,
    provider_operation_id: str | None = None,
    status: ProviderOperationStatus = ProviderOperationStatus.UNKNOWN,
) -> DurableImageOperation:
    return DurableImageOperation(
        id=20,
        stage_attempt_id=10,
        provider_key="vertex",
        request_fingerprint="a" * 64,
        provider_operation_id=provider_operation_id,
        status=status,
        row_version=7,
        items=(),
        worker_id=None,
        lease_token=None,
    )


def _repository(connection: _Connection) -> ImageGenerationRepository:
    repository = ImageGenerationRepository(
        "postgresql://unused",
        lease_seconds=30,
        settings=WorkerSettings(worker_env="test"),
    )
    repository._pool = cast(Any, _Pool(connection))
    return repository


@pytest.mark.asyncio
async def test_expired_unresolved_unknown_terminalizes_operation_items_and_job_atomically() -> None:
    connection = _Connection("FAILED")
    repository = _repository(connection)
    aggregate_calls: list[tuple[Any, int]] = []

    async def aggregate(connection_arg: Any, stage_attempt_id: int) -> None:
        aggregate_calls.append((connection_arg, stage_attempt_id))

    repository._aggregate_generation_job = cast(Any, aggregate)
    operation = _operation()

    transitioned = await repository.mark_unknown(operation, "NETWORK_TIMEOUT")

    assert transitioned is True
    provider_query, provider_args = connection.fetchrow_calls[0]
    assert "provider_operation_id IS NULL" in provider_query
    assert "THEN 'FAILED'" in provider_query
    assert "PROVIDER_SUBMISSION_UNRESOLVED" in provider_query
    assert "row_version = $3" in provider_query
    assert provider_args[0] == operation.id
    assert provider_args[2] == operation.row_version
    assert len(connection.execute_calls) == 1
    item_query, item_args = connection.execute_calls[0]
    assert "execution_status = 'FAILED'" in item_query
    assert "PROVIDER_SUBMISSION_UNRESOLVED" in item_query
    assert item_args == (operation.id,)
    assert aggregate_calls == [(connection, operation.stage_attempt_id)]


@pytest.mark.asyncio
async def test_expired_known_provider_operation_reschedules_instead_of_terminalizing() -> None:
    connection = _Connection("UNKNOWN")
    repository = _repository(connection)
    aggregate_calls: list[tuple[Any, int]] = []

    async def aggregate(connection_arg: Any, stage_attempt_id: int) -> None:
        aggregate_calls.append((connection_arg, stage_attempt_id))

    repository._aggregate_generation_job = cast(Any, aggregate)
    operation = _operation(
        provider_operation_id="projects/p/locations/global/batchPredictionJobs/123",
        status=ProviderOperationStatus.RUNNING,
    )

    transitioned = await repository.mark_unknown(operation, "NETWORK_TIMEOUT")

    assert transitioned is True
    provider_query, _ = connection.fetchrow_calls[0]
    assert "provider_operation_id IS NULL" in provider_query
    assert "CURRENT_TIMESTAMP + INTERVAL '15 seconds'" in provider_query
    assert connection.execute_calls == []
    assert aggregate_calls == []


@pytest.mark.asyncio
async def test_recoverable_unresolved_unknown_reschedules_without_terminalizing_items() -> None:
    connection = _Connection("UNKNOWN")
    repository = _repository(connection)
    aggregate_calls: list[tuple[Any, int]] = []

    async def aggregate(connection_arg: Any, stage_attempt_id: int) -> None:
        aggregate_calls.append((connection_arg, stage_attempt_id))

    repository._aggregate_generation_job = cast(Any, aggregate)

    transitioned = await repository.mark_unknown(_operation(), "NETWORK_TIMEOUT")

    assert transitioned is True
    provider_query, _ = connection.fetchrow_calls[0]
    assert "CURRENT_TIMESTAMP + INTERVAL '15 seconds'" in provider_query
    assert connection.execute_calls == []
    assert aggregate_calls == []


@pytest.mark.asyncio
async def test_stale_unknown_transition_does_not_mutate_items_or_aggregate() -> None:
    connection = _Connection(None)
    repository = _repository(connection)
    aggregate_calls: list[tuple[Any, int]] = []

    async def aggregate(connection_arg: Any, stage_attempt_id: int) -> None:
        aggregate_calls.append((connection_arg, stage_attempt_id))

    repository._aggregate_generation_job = cast(Any, aggregate)

    transitioned = await repository.mark_unknown(_operation(), "STALE")

    assert transitioned is False
    assert connection.execute_calls == []
    assert aggregate_calls == []
