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
    def __init__(self, provider_update_result: str) -> None:
        self.provider_update_result = provider_update_result
        self.execute_calls: list[tuple[str, tuple[Any, ...]]] = []

    def transaction(self) -> _Transaction:
        return _Transaction()

    async def execute(self, query: str, *args: Any) -> str:
        self.execute_calls.append((query, args))
        if "UPDATE provider_operations" in query:
            return self.provider_update_result
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


def _operation(*, owned: bool = True) -> DurableImageOperation:
    return DurableImageOperation(
        id=20,
        stage_attempt_id=10,
        provider_key="vertex",
        request_fingerprint="a" * 64,
        provider_operation_id="vertex-operation-20",
        status=ProviderOperationStatus.RUNNING,
        row_version=7,
        items=(),
        worker_id="worker-1" if owned else None,
        lease_token=(
            "00000000-0000-0000-0000-000000000001" if owned else None
        ),
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
async def test_fail_provider_operation_uses_state_version_and_owner_fence() -> None:
    connection = _Connection("UPDATE 1")
    repository = _repository(connection)
    aggregate_calls: list[int] = []

    async def aggregate(stage_attempt_id: int) -> None:
        aggregate_calls.append(stage_attempt_id)

    repository.aggregate_generation_job = cast(Any, aggregate)
    operation = _operation()

    transitioned = await repository.fail_provider_operation(operation, "HTTP_400")

    assert transitioned is True
    provider_query, provider_args = next(
        call for call in connection.execute_calls if "UPDATE provider_operations" in call[0]
    )
    assert "status IN ('RESERVED', 'UNKNOWN', 'SUBMITTED', 'RUNNING')" in provider_query
    assert "row_version = $3" in provider_query
    assert "stage_attempts" in provider_query
    assert provider_args == (
        operation.id,
        "HTTP_400",
        operation.row_version,
        operation.worker_id,
        operation.lease_token,
    )
    assert any("UPDATE media_generation_items" in query for query, _ in connection.execute_calls)
    assert aggregate_calls == [operation.stage_attempt_id]


@pytest.mark.asyncio
async def test_stale_failure_cannot_mutate_items_or_aggregate_job() -> None:
    connection = _Connection("UPDATE 0")
    repository = _repository(connection)
    aggregate_calls: list[int] = []

    async def aggregate(stage_attempt_id: int) -> None:
        aggregate_calls.append(stage_attempt_id)

    repository.aggregate_generation_job = cast(Any, aggregate)

    transitioned = await repository.fail_provider_operation(_operation(), "STALE_WORKER")

    assert transitioned is False
    assert not any(
        "UPDATE media_generation_items" in query for query, _ in connection.execute_calls
    )
    assert aggregate_calls == []


@pytest.mark.asyncio
async def test_unowned_reconciler_is_still_row_version_fenced() -> None:
    connection = _Connection("UPDATE 1")
    repository = _repository(connection)

    async def aggregate(stage_attempt_id: int) -> None:
        del stage_attempt_id

    repository.aggregate_generation_job = cast(Any, aggregate)
    operation = _operation(owned=False)

    transitioned = await repository.fail_provider_operation(operation, "PROVIDER_FAILED")

    assert transitioned is True
    provider_query, provider_args = next(
        call for call in connection.execute_calls if "UPDATE provider_operations" in call[0]
    )
    assert "row_version = $3" in provider_query
    assert provider_args[2] == operation.row_version
    assert provider_args[3:] == (None, None)
