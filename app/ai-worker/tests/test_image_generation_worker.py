import asyncio
import logging
from types import SimpleNamespace
from typing import Any, cast
from uuid import UUID

import pytest

from narrativex_worker.circuit_breaker import ProviderCircuitBreaker
from narrativex_worker.image_generation_repository import (
    ClaimedImageGenerationJob,
    DurableImageOperation,
    ImageGenerationLeaseLostError,
)
from narrativex_worker.image_generation_worker import ImageGenerationWorkerRunner
from narrativex_worker.providers.image import (
    ImageBatchItem,
    ImageBatchOperation,
    ImageGenerationRequest,
)
from narrativex_worker.providers.vertex_image import (
    VertexImageProviderError,
    VertexImageSubmissionUnknownError,
)
from narrativex_worker.schema import ImageAspectRatio, ProviderOperationStatus


class _Repository:
    def __init__(self, operation: DurableImageOperation, *, block_load: bool = False) -> None:
        self.operation = operation
        self.block_load = block_load
        self.load_release = asyncio.Event()
        self.mark_submitted_calls: list[ProviderOperationStatus] = []
        self.mark_unknown_calls: list[str] = []
        self.fail_provider_operation_calls: list[str] = []
        self.complete_provider_operation_calls = 0
        self.aggregate_calls = 0
        self.assert_lease_calls = 0

    async def load_pending_items(self, job: ClaimedImageGenerationJob) -> tuple[Any, ...]:
        del job
        if self.block_load:
            await self.load_release.wait()
        item = _item()
        return (SimpleNamespace(item_key=item.item_key, request=item.request),)

    async def resolve_reused_items(self, stage_attempt_id: UUID) -> int:
        del stage_attempt_id
        return 0

    async def assert_lease(self, job: ClaimedImageGenerationJob) -> None:
        del job
        self.assert_lease_calls += 1

    async def prepare_provider_submission(
        self, job: ClaimedImageGenerationJob, items: tuple[ImageBatchItem, ...]
    ) -> DurableImageOperation:
        del job, items
        return self.operation

    async def mark_submitted(
        self,
        operation: DurableImageOperation,
        provider_operation_id: str | None,
        status: ProviderOperationStatus,
    ) -> DurableImageOperation:
        del operation, provider_operation_id
        self.mark_submitted_calls.append(status)
        return self.operation

    async def mark_unknown(self, operation: DurableImageOperation, error: str) -> None:
        del operation
        self.mark_unknown_calls.append(error)

    async def fail_provider_operation(self, operation: DurableImageOperation, error: str) -> None:
        del operation
        self.fail_provider_operation_calls.append(error)
        self.aggregate_calls += 1

    async def mark_failed(
        self,
        item_key: str,
        request_fingerprint: str,
        error: str,
        *,
        operation: DurableImageOperation | None = None,
    ) -> bool:
        del item_key, request_fingerprint, error, operation
        return True

    async def complete_provider_operation(
        self, operation: DurableImageOperation, results: tuple[object, ...]
    ) -> None:
        del operation, results
        self.complete_provider_operation_calls += 1

    async def aggregate_generation_job(self, stage_attempt_id: int) -> None:
        del stage_attempt_id
        self.aggregate_calls += 1


class _PersistenceFailureRepository(_Repository):
    def __init__(self, operation: DurableImageOperation, exception: Exception) -> None:
        super().__init__(operation)
        self.exception = exception

    async def mark_submitted(
        self,
        operation: DurableImageOperation,
        provider_operation_id: str | None,
        status: ProviderOperationStatus,
    ) -> DurableImageOperation:
        del operation, provider_operation_id
        self.mark_submitted_calls.append(status)
        raise self.exception


class _Provider:
    def __init__(self, result: ImageBatchOperation | Exception) -> None:
        self.result = result
        self.calls = 0

    async def submit_batch(self, items: tuple[ImageBatchItem, ...]) -> ImageBatchOperation:
        del items
        self.calls += 1
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class _BlockingProvider:
    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.cancelled = False

    async def submit_batch(self, items: tuple[ImageBatchItem, ...]) -> ImageBatchOperation:
        del items
        self.started.set()
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            self.cancelled = True
            raise
        raise AssertionError("blocking provider unexpectedly returned")


def _operation() -> DurableImageOperation:
    return DurableImageOperation(
        id=20,
        stage_attempt_id=10,
        provider_key="vertex",
        request_fingerprint="a" * 64,
        provider_operation_id=None,
        status=ProviderOperationStatus.UNKNOWN,
        row_version=0,
        items=(),
        created=True,
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


def _item() -> ImageBatchItem:
    return ImageBatchItem(
        item_key="beat-1",
        request=ImageGenerationRequest(
            request_fingerprint="a" * 64,
            prompt="A quiet room",
            negative_prompt=None,
            aspect_ratio=ImageAspectRatio.RATIO_16_9,
            provider_key="vertex",
            model_key="gemini-2.5-flash-image",
            location="global",
        ),
    )


def _runner(repository: _Repository, provider: _Provider) -> Any:
    runner = cast(Any, object.__new__(ImageGenerationWorkerRunner))
    runner.repository = repository
    runner.provider = provider
    runner.settings = SimpleNamespace(
        vertex_image_batch_max_items=8,
        image_circuit_breaker_failure_threshold=3,
        image_circuit_breaker_open_seconds=120,
    )
    runner.circuit_breaker = ProviderCircuitBreaker(3, 120)
    runner._concurrency_gate = asyncio.Semaphore(1)
    runner.logger = logging.getLogger("test.image-generation")
    return runner


def _failed_operation() -> ImageBatchOperation:
    return ImageBatchOperation(
        provider_key="vertex",
        operation_id=None,
        status=ProviderOperationStatus.FAILED,
        items=(_item(),),
        error_code="HTTP_400",
    )


def _running_operation() -> ImageBatchOperation:
    return ImageBatchOperation(
        provider_key="vertex",
        operation_id="vertex-operation-20",
        status=ProviderOperationStatus.RUNNING,
        items=(_item(),),
    )


@pytest.mark.asyncio
async def test_submit_batch_persists_provider_failed_and_fails_items() -> None:
    repository = _Repository(_operation())
    runner = _runner(repository, _Provider(_failed_operation()))
    await runner._submit_batch(_job(), (_item(),))
    assert repository.mark_submitted_calls == []
    assert repository.fail_provider_operation_calls == ["HTTP_400"]
    assert repository.complete_provider_operation_calls == 0
    assert repository.aggregate_calls == 1


@pytest.mark.asyncio
async def test_submit_batch_treats_deterministic_provider_error_as_failed() -> None:
    repository = _Repository(_operation())
    runner = _runner(repository, _Provider(VertexImageProviderError("HTTP_400")))
    await runner._submit_batch(_job(), (_item(),))
    assert repository.mark_unknown_calls == []
    assert repository.fail_provider_operation_calls == ["HTTP_400"]


@pytest.mark.asyncio
async def test_submit_batch_does_not_call_provider_when_circuit_is_open() -> None:
    repository = _Repository(_operation())
    provider = _Provider(VertexImageProviderError("HTTP_503"))
    runner = _runner(repository, provider)
    runner.circuit_breaker = ProviderCircuitBreaker(1, 120)
    await runner._submit_batch(_job(), (_item(),))
    await runner._submit_batch(_job(), (_item(),))
    assert provider.calls == 1
    assert repository.fail_provider_operation_calls == ["HTTP_503", "IMAGE_CIRCUIT_BREAKER_OPEN"]


@pytest.mark.asyncio
async def test_submit_batch_keeps_unknown_for_ambiguous_provider_error() -> None:
    repository = _Repository(_operation())
    runner = _runner(repository, _Provider(VertexImageSubmissionUnknownError("request timed out")))
    await runner._submit_batch(_job(), (_item(),))
    assert repository.mark_unknown_calls == ["REQUEST TIMED OUT"]
    assert repository.fail_provider_operation_calls == []


@pytest.mark.asyncio
async def test_submit_batch_keeps_unknown_for_unclassified_exception_after_paid_boundary() -> None:
    repository = _Repository(_operation())
    runner = _runner(repository, _Provider(RuntimeError("connection reset")))
    await runner._submit_batch(_job(), (_item(),))
    assert repository.mark_unknown_calls == ["CONNECTION RESET"]
    assert repository.fail_provider_operation_calls == []


@pytest.mark.asyncio
async def test_submit_batch_persistence_failure_stays_recoverable_instead_of_failed() -> None:
    repository = _PersistenceFailureRepository(_operation(), RuntimeError("db unavailable"))
    runner = _runner(repository, _Provider(_running_operation()))
    await runner._submit_batch(_job(), (_item(),))
    assert repository.mark_submitted_calls == [ProviderOperationStatus.RUNNING]
    assert repository.fail_provider_operation_calls == []
    assert repository.mark_unknown_calls == [
        "PROVIDER_SUBMISSION_PERSISTENCE_UNKNOWN:DB UNAVAILABLE"
    ]


@pytest.mark.asyncio
async def test_submit_batch_lease_loss_after_provider_return_does_not_terminalize() -> None:
    repository = _PersistenceFailureRepository(
        _operation(), ImageGenerationLeaseLostError("reclaimed")
    )
    runner = _runner(repository, _Provider(_running_operation()))
    await runner._submit_batch(_job(), (_item(),))
    assert repository.mark_submitted_calls == [ProviderOperationStatus.RUNNING]
    assert repository.mark_unknown_calls == []
    assert repository.fail_provider_operation_calls == []


@pytest.mark.asyncio
async def test_process_cancels_processing_when_heartbeat_loses_lease() -> None:
    repository = _Repository(_operation(), block_load=True)
    provider = _Provider(_failed_operation())
    runner = _runner(repository, provider)

    async def lost_heartbeat(job: ClaimedImageGenerationJob) -> None:
        del job
        raise ImageGenerationLeaseLostError("reclaimed")

    runner._heartbeat = lost_heartbeat
    await runner._process(_job())
    assert provider.calls == 0
    assert repository.assert_lease_calls == 0


@pytest.mark.asyncio
async def test_lease_loss_cancels_provider_call_already_in_flight() -> None:
    repository = _Repository(_operation())
    provider = _BlockingProvider()
    runner = _runner(repository, cast(Any, provider))

    async def lost_after_provider_starts(job: ClaimedImageGenerationJob) -> None:
        del job
        await provider.started.wait()
        raise ImageGenerationLeaseLostError("reclaimed")

    runner._heartbeat = lost_after_provider_starts
    await runner._process(_job())
    assert repository.assert_lease_calls == 1
    assert provider.cancelled is True
