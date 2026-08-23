from typing import Any, cast

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.image_generation_repository import (
    DurableImageOperation,
    ImageGenerationLeaseLostError,
    ImageGenerationRepository,
)
from narrativex_worker.schema import ProviderOperationStatus


class _Transaction:
    async def __aenter__(self) -> "_Transaction":
        return self

    async def __aexit__(self, exception_type: object, exception: object, traceback: object) -> None:
        return None


class _Connection:
    def __init__(self, row: dict[str, int] | None) -> None:
        self.row = row
        self.fetchrow_calls: list[tuple[str, tuple[Any, ...]]] = []

    def transaction(self) -> _Transaction:
        return _Transaction()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, int] | None:
        self.fetchrow_calls.append((query, args))
        return self.row


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
        lease_token="00000000-0000-0000-0000-000000000001" if owned else None,
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
async def test_completion_is_fenced_by_stage_owner_and_lease() -> None:
    connection = _Connection({"id": 20})
    repository = _repository(connection)
    aggregate_calls: list[int] = []

    async def aggregate(connection_arg: object, stage_attempt_id: int) -> None:
        del connection_arg
        aggregate_calls.append(stage_attempt_id)

    repository._aggregate_generation_job = cast(Any, aggregate)
    operation = _operation()

    await repository.complete_provider_operation(operation, ())

    query, args = connection.fetchrow_calls[0]
    assert "stage_attempts" in query
    assert "sa.worker_id = $5" in query
    assert "sa.lease_token = $6::uuid" in query
    assert "sa.status = 'RUNNING'" in query
    assert args[3:] == (operation.row_version, operation.worker_id, operation.lease_token)
    assert aggregate_calls == [operation.stage_attempt_id]


@pytest.mark.asyncio
async def test_stale_owner_cannot_complete_provider_operation() -> None:
    connection = _Connection(None)
    repository = _repository(connection)
    repository._aggregate_generation_job = cast(Any, lambda *_: None)

    with pytest.raises(ImageGenerationLeaseLostError, match="stage lease was lost"):
        await repository.complete_provider_operation(_operation(), ())


@pytest.mark.asyncio
async def test_unowned_reconciler_remains_row_version_fenced() -> None:
    connection = _Connection({"id": 20})
    repository = _repository(connection)

    async def aggregate(connection_arg: object, stage_attempt_id: int) -> None:
        del connection_arg, stage_attempt_id

    repository._aggregate_generation_job = cast(Any, aggregate)
    operation = _operation(owned=False)

    await repository.complete_provider_operation(operation, ())

    query, args = connection.fetchrow_calls[0]
    assert "row_version = $4" in query
    assert args[3:] == (operation.row_version, None, None)
