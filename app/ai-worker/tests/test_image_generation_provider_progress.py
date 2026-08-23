from typing import Any, cast

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.image_generation_repository import (
    DurableImageOperation,
    ImageGenerationLeaseLostError,
    ImageGenerationRepository,
)
from narrativex_worker.schema import ProviderOperationStatus


class _Pool:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        self.calls.append((query, args))
        return self.row


def _operation(
    status: ProviderOperationStatus = ProviderOperationStatus.SUBMITTED,
) -> DurableImageOperation:
    return DurableImageOperation(
        id=20,
        stage_attempt_id=10,
        provider_key="vertex",
        request_fingerprint="a" * 64,
        provider_operation_id="provider-op-20",
        status=status,
        row_version=7,
        items=(),
        worker_id=None,
        lease_token=None,
    )


def _repository(pool: _Pool) -> ImageGenerationRepository:
    repository = ImageGenerationRepository(
        "postgresql://unused",
        lease_seconds=30,
        settings=WorkerSettings(worker_env="test"),
    )
    repository._pool = cast(Any, pool)
    return repository


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("current_status", "reported_status", "returned_status"),
    [
        (ProviderOperationStatus.SUBMITTED, ProviderOperationStatus.SUBMITTED, "SUBMITTED"),
        (ProviderOperationStatus.SUBMITTED, ProviderOperationStatus.RUNNING, "RUNNING"),
        (ProviderOperationStatus.RUNNING, ProviderOperationStatus.RUNNING, "RUNNING"),
        (ProviderOperationStatus.RUNNING, ProviderOperationStatus.SUBMITTED, "RUNNING"),
    ],
)
async def test_provider_progress_supports_idempotency_and_no_regression(
    current_status: ProviderOperationStatus,
    reported_status: ProviderOperationStatus,
    returned_status: str,
) -> None:
    operation = _operation(current_status)
    pool = _Pool(
        {
            "id": operation.id,
            "stage_attempt_id": operation.stage_attempt_id,
            "provider_key": operation.provider_key,
            "request_fingerprint": operation.request_fingerprint,
            "provider_operation_id": operation.provider_operation_id,
            "status": returned_status,
            "row_version": operation.row_version + 1,
        }
    )
    repository = _repository(pool)

    updated = await repository.mark_submitted(
        operation,
        operation.provider_operation_id,
        reported_status,
    )

    query, args = pool.calls[0]
    assert "status IN ('RESERVED', 'UNKNOWN', 'SUBMITTED', 'RUNNING')" in query
    assert "status = 'RUNNING' AND $2 = 'SUBMITTED'" in query
    assert "COALESCE(provider_operation_id, $3)" in query
    assert "provider_operation_id = $3" in query
    assert "row_version = $4" in query
    assert args[1] == reported_status.value
    assert updated.status is ProviderOperationStatus(returned_status)


@pytest.mark.asyncio
async def test_provider_progress_rejects_stale_row_or_provider_id_conflict() -> None:
    operation = _operation()
    repository = _repository(_Pool(None))

    with pytest.raises(ImageGenerationLeaseLostError):
        await repository.mark_submitted(
            operation,
            "different-provider-operation",
            ProviderOperationStatus.RUNNING,
        )


@pytest.mark.asyncio
async def test_provider_progress_rejects_terminal_status_input() -> None:
    repository = _repository(_Pool(None))

    with pytest.raises(ValueError):
        await repository.mark_submitted(
            _operation(),
            "provider-op-20",
            ProviderOperationStatus.COMPLETED,
        )
