from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.image_generation_repository import (
    ClaimedImageGenerationJob,
    DurableImageOperation,
    ImageGenerationLeaseLostError,
    ImageGenerationRepository,
)
from narrativex_worker.providers.image import ImageBatchItem, ImageGenerationRequest
from narrativex_worker.schema import ImageAspectRatio, ProviderOperationStatus


class _Transaction:
    def __init__(self) -> None:
        self.committed = False
        self.rolled_back = False

    async def __aenter__(self) -> "_Transaction":
        return self

    async def __aexit__(self, exception_type: object, exception: object, traceback: object) -> None:
        if exception_type is None:
            self.committed = True
        else:
            self.rolled_back = True


class _Connection:
    def __init__(self, *, lease: bool = True, updated_count: int = 1) -> None:
        self.transaction_state = _Transaction()
        self.lease = lease
        self.updated_count = updated_count
        self.queries: list[str] = []
        self.last_args: tuple[Any, ...] = ()

    def transaction(self) -> _Transaction:
        return self.transaction_state

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        self.queries.append(query)
        self.last_args = args
        if query.lstrip().startswith("SELECT id"):
            return {"id": 10} if self.lease else None
        if query.lstrip().startswith("INSERT INTO provider_operations"):
            return {
                "id": 20,
                "stage_attempt_id": 10,
                "provider_key": "vertex",
                "request_fingerprint": args[2],
                "provider_operation_id": None,
                "status": "UNKNOWN",
                "row_version": 0,
            }
        raise AssertionError(f"Unexpected fetchrow query: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        self.queries.append(query)
        return f"UPDATE {self.updated_count}"


class _Pool:
    def __init__(self, connection: Any) -> None:
        self.connection = connection

    async def __aenter__(self) -> Any:
        return self.connection

    async def __aexit__(self, exception_type: object, exception: object, traceback: object) -> None:
        return None

    def acquire(self) -> "_Pool":
        return self


class _StatusConnection(_Connection):
    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        self.queries.append(query)
        self.last_args = args
        if query.lstrip().startswith("UPDATE provider_operations"):
            return {
                "id": 20,
                "stage_attempt_id": 10,
                "provider_key": "vertex",
                "request_fingerprint": "a" * 64,
                "provider_operation_id": None,
                "status": "FAILED" if "SET status = 'FAILED'" in query else args[1],
                "row_version": 1,
            }
        raise AssertionError(f"Unexpected fetchrow query: {query}")


class _StatusPool(_Pool):
    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        return cast(dict[str, Any] | None, await self.connection.fetchrow(query, *args))


class _CompletionConnection:
    def __init__(
        self,
        *,
        total: int,
        ready: int,
        failed: int,
        pending: int,
        initial_job_status: str = "RUNNING",
    ) -> None:
        self.transaction_state = _Transaction()
        self.summary = {"total": total, "ready": ready, "failed": failed, "pending": pending}
        self.initial_job_status = initial_job_status
        self.job_status: str | None = None
        self.stage_status: str | None = None
        self.execute_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.transaction_calls = 0

    def transaction(self) -> _Transaction:
        self.transaction_calls += 1
        return self.transaction_state

    async def fetch(self, query: str, *args: Any) -> list[dict[str, str]]:
        del args
        if "COUNT(*) AS total" in query:
            return [self.summary]
        raise AssertionError(f"Unexpected fetch query: {query}")

    async def fetchrow(self, query: str, *args: Any) -> dict[str, int] | None:
        self.execute_calls.append((query, args))
        if "UPDATE provider_operations" in query:
            return {"id": 20}
        if "FROM stage_attempts" in query:
            return {"generation_job_id": 1}
        if "COUNT(*) AS total" in query:
            return self.summary
        raise AssertionError(f"Unexpected fetchrow query: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        self.execute_calls.append((query, args))
        if "UPDATE stage_attempts" in query:
            self.stage_status = str(args[1])
        if "UPDATE generation_jobs" in query:
            if self.initial_job_status != "COMPLETED" or "'COMPLETED'" in query:
                self.job_status = str(args[1])
        return "UPDATE 1"


def _repository(connection: Any) -> ImageGenerationRepository:
    repository = ImageGenerationRepository(
        "postgresql://unused",
        lease_seconds=30,
        settings=WorkerSettings(worker_env="test"),
    )
    repository._pool = _Pool(connection)
    return repository


def _completion_operation() -> DurableImageOperation:
    return DurableImageOperation(
        id=20,
        stage_attempt_id=10,
        provider_key="vertex",
        request_fingerprint="a" * 64,
        provider_operation_id="vertex-operation-20",
        status=ProviderOperationStatus.RUNNING,
        row_version=0,
        items=(),
    )


@dataclass(frozen=True)
class _Fixture:
    repository: ImageGenerationRepository
    connection: _Connection
    job: ClaimedImageGenerationJob
    item: ImageBatchItem


def _fixture(*, lease: bool = True, updated_count: int = 1) -> _Fixture:
    connection = _Connection(lease=lease, updated_count=updated_count)
    repository = _repository(connection)
    job = ClaimedImageGenerationJob(
        generation_job_id=UUID("00000000-0000-4000-8000-000000000001"),
        stage_attempt_id=UUID("00000000-0000-4000-8000-000000000010"),
        lease_token="00000000-0000-0000-0000-000000000001",
        project_id=UUID("00000000-0000-4000-8000-000000000001"),
        media_plan_id=UUID("00000000-0000-0000-0000-000000000002"),
        worker_id="worker-1",
    )
    item = ImageBatchItem(
        item_key="beat-1",
        request=ImageGenerationRequest(
            request_fingerprint="a" * 64,
            prompt="A quiet room",
            negative_prompt=None,
            aspect_ratio=ImageAspectRatio.RATIO_16_9,
            provider_key="vertex",
            model_key="imagen-3",
            location="global",
        ),
    )
    return _Fixture(repository, connection, job, item)


@pytest.mark.asyncio
async def test_prepare_provider_submission_commits_unknown_fence_and_item_binding() -> None:
    fixture = _fixture()
    operation = await fixture.repository.prepare_provider_submission(fixture.job, (fixture.item,))
    assert operation.created is True
    assert operation.status is ProviderOperationStatus.UNKNOWN
    assert fixture.connection.transaction_state.committed is True
    assert fixture.connection.transaction_state.rolled_back is False
    assert any("UPDATE media_generation_items" in query for query in fixture.connection.queries)


@pytest.mark.asyncio
async def test_prepare_provider_submission_rolls_back_when_item_set_is_claimed() -> None:
    fixture = _fixture(updated_count=0)
    with pytest.raises(RuntimeError, match="IMAGE_GENERATION_ITEMS_ALREADY_CLAIMED"):
        await fixture.repository.prepare_provider_submission(fixture.job, (fixture.item,))
    assert fixture.connection.transaction_state.committed is False
    assert fixture.connection.transaction_state.rolled_back is True


@pytest.mark.asyncio
async def test_prepare_provider_submission_rolls_back_when_lease_is_lost() -> None:
    fixture = _fixture(lease=False)
    with pytest.raises(ImageGenerationLeaseLostError):
        await fixture.repository.prepare_provider_submission(fixture.job, (fixture.item,))
    assert fixture.connection.transaction_state.committed is False
    assert fixture.connection.transaction_state.rolled_back is True
    assert not any(
        "INSERT INTO provider_operations" in query for query in fixture.connection.queries
    )


@pytest.mark.asyncio
async def test_mark_submitted_rejects_provider_failed_status() -> None:
    connection = _StatusConnection()
    repository = _repository(connection)
    repository._pool = _StatusPool(connection)
    with pytest.raises(ValueError, match="invalid submitted status"):
        await repository.mark_submitted(
            _completion_operation(),
            None,
            ProviderOperationStatus.FAILED,
        )


@pytest.mark.asyncio
async def test_mark_submitted_carries_claimed_worker_lease_fence() -> None:
    connection = _StatusConnection()
    repository = _repository(connection)
    repository._pool = _StatusPool(connection)
    operation = DurableImageOperation(
        **{
            **_completion_operation().__dict__,
            "worker_id": "worker-1",
            "lease_token": "00000000-0000-0000-0000-000000000001",
        }
    )
    await repository.mark_submitted(
        operation,
        "vertex-operation-20",
        ProviderOperationStatus.RUNNING,
    )
    query = next(
        query for query in connection.queries if query.lstrip().startswith("UPDATE")
    )
    assert "stage_attempts" in query
    assert operation.worker_id in connection.last_args
    assert operation.lease_token in connection.last_args


@pytest.mark.asyncio
async def test_fail_provider_operation_persists_terminal_provider_failure() -> None:
    connection = _CompletionConnection(total=1, ready=0, failed=1, pending=0)
    repository = _repository(connection)
    await repository.fail_provider_operation(_completion_operation(), "HTTP_400")
    assert any("UPDATE provider_operations" in query for query, _ in connection.execute_calls)
    assert connection.stage_status == "FAILED"
    assert connection.job_status == "FAILED"


@pytest.mark.asyncio
async def test_aggregate_generation_job_keeps_job_running_until_all_batches_finish() -> None:
    connection = _CompletionConnection(total=120, ready=50, failed=0, pending=70)
    repository = _repository(connection)
    await repository.aggregate_generation_job(10)
    assert connection.stage_status == "RUNNING"
    assert connection.job_status == "RUNNING"
    job_update = next(
        query for query in connection.execute_calls if "UPDATE generation_jobs" in query[0]
    )
    assert job_update[1][1:] == ("RUNNING", 41, "SHOT_IMAGE_GENERATE_RUNNING")


@pytest.mark.asyncio
async def test_aggregate_generation_job_fails_when_any_job_item_failed() -> None:
    connection = _CompletionConnection(total=2, ready=1, failed=1, pending=0)
    repository = _repository(connection)
    await repository.aggregate_generation_job(10)
    assert connection.stage_status == "FAILED"
    assert connection.job_status == "FAILED"


@pytest.mark.asyncio
async def test_aggregate_generation_job_completes_when_all_job_items_ready() -> None:
    connection = _CompletionConnection(total=2, ready=2, failed=0, pending=0)
    repository = _repository(connection)
    await repository.aggregate_generation_job(10)
    assert connection.stage_status == "COMPLETED"
    assert connection.job_status == "COMPLETED"


@pytest.mark.asyncio
async def test_aggregate_generation_job_reconciles_late_failure_after_completion() -> None:
    connection = _CompletionConnection(
        total=2,
        ready=1,
        failed=1,
        pending=0,
        initial_job_status="COMPLETED",
    )
    repository = _repository(connection)
    await repository.aggregate_generation_job(10)
    assert connection.stage_status == "FAILED"
    assert connection.job_status == "FAILED"


@pytest.mark.asyncio
async def test_complete_provider_operation_updates_provider_then_aggregates_job() -> None:
    connection = _CompletionConnection(total=2, ready=1, failed=0, pending=1)
    repository = _repository(connection)
    await repository.complete_provider_operation(_completion_operation(), ())
    provider_index = next(
        index
        for index, (query, _) in enumerate(connection.execute_calls)
        if "UPDATE provider_operations" in query
    )
    stage_index = next(
        index
        for index, (query, _) in enumerate(connection.execute_calls)
        if "UPDATE stage_attempts" in query
    )
    assert provider_index < stage_index
    provider_query, provider_args = connection.execute_calls[provider_index]
    assert "normalized_result_json = $2::jsonb" in provider_query
    assert "result_fingerprint = $3" in provider_query
    assert "completed_at = CURRENT_TIMESTAMP" in provider_query
    assert provider_args[0] == 20
    assert connection.transaction_calls == 1
    assert connection.stage_status == "RUNNING"
    assert connection.job_status == "RUNNING"
