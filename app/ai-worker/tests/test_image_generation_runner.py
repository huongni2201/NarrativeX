import hashlib
from collections.abc import Sequence

import pytest

from narrativex_worker.image_generation_runner import (
    ImageGenerationPendingError,
    ImageGenerationRunner,
)
from narrativex_worker.image_generation_worker import _partition_batches
from narrativex_worker.media_repository import DurableMediaResult
from narrativex_worker.narration.storage import InMemoryMediaStorage
from narrativex_worker.providers.image import (
    ImageBatchItem,
    ImageBatchItemResult,
    ImageBatchOperation,
    ImageGenerationRequest,
    ImageGenerationResult,
    ImageProviderOperation,
)
from narrativex_worker.schema import (
    ImageAspectRatio,
    ImageQualityTier,
    ModerationDecision,
    ProviderOperationStatus,
)


class _Repository:
    def __init__(self) -> None:
        self.completions: list[tuple[str, str, DurableMediaResult]] = []
        self.assets: list[tuple[str, str, ImageGenerationResult, DurableMediaResult]] = []

    async def persist_provider_completion(
        self, item_key: str, request_fingerprint: str, result: DurableMediaResult
    ) -> None:
        self.completions.append((item_key, request_fingerprint, result))

    async def materialize_asset(
        self,
        item_key: str,
        request_fingerprint: str,
        result: ImageGenerationResult,
        stored: DurableMediaResult,
    ) -> None:
        self.assets.append((item_key, request_fingerprint, result, stored))


class _BatchProvider:
    def __init__(self) -> None:
        self.submitted: tuple[ImageBatchItem, ...] | None = None
        self.reconciled: ImageBatchOperation | None = None
        self.reconcile_result: ImageBatchOperation | None = None

    def get_capabilities(self) -> object:
        return object()

    async def submit(self, request: ImageGenerationRequest) -> ImageProviderOperation:
        del request
        raise AssertionError("batch-only runner must never call online submit")

    async def reconcile(self, operation: ImageProviderOperation) -> ImageProviderOperation:
        del operation
        raise AssertionError("batch-only runner must never call online reconcile")

    async def submit_batch(self, items: Sequence[ImageBatchItem]) -> ImageBatchOperation:
        self.submitted = tuple(items)
        return ImageBatchOperation(
            provider_key="vertex",
            operation_id="projects/p/locations/global/batchPredictionJobs/123",
            status=ProviderOperationStatus.SUBMITTED,
            items=tuple(items),
            input_uri="gs://bucket/input.jsonl",
            output_uri="gs://bucket/output",
        )

    async def reconcile_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation:
        self.reconciled = operation
        return self.reconcile_result or operation


def _request() -> ImageGenerationRequest:
    return ImageGenerationRequest(
        request_fingerprint="a" * 64,
        prompt="cinematic scene",
        negative_prompt=None,
        aspect_ratio=ImageAspectRatio.RATIO_16_9,
        quality_tier=ImageQualityTier.STANDARD,
        provider_key="vertex",
        model_key="gemini-2.5-flash-image",
        location="global",
    )


@pytest.mark.asyncio
async def test_run_submits_single_image_through_batch_only() -> None:
    provider = _BatchProvider()
    runner = ImageGenerationRunner(provider, InMemoryMediaStorage(), _Repository())

    with pytest.raises(ImageGenerationPendingError) as caught:
        await runner.run("beat-1", _request())

    assert provider.submitted is not None
    assert len(provider.submitted) == 1
    assert provider.submitted[0].item_key == "beat-1"
    assert caught.value.operation.operation_id is not None


@pytest.mark.asyncio
async def test_reconcile_materializes_completed_batch_result() -> None:
    provider = _BatchProvider()
    storage = InMemoryMediaStorage()
    repository = _Repository()
    runner = ImageGenerationRunner(provider, storage, repository)
    request = _request()
    submitted = await runner.submit("beat-1", request)

    content = b"fake-image-bytes"
    checksum = hashlib.sha256(content).hexdigest()
    result = ImageGenerationResult(
        mime_type="image/png",
        content=content,
        width=1600,
        height=900,
        moderation=ModerationDecision.SAFE,
        result_fingerprint=checksum,
        provider_metadata={"executionMode": "BATCH"},
    )
    provider.reconcile_result = ImageBatchOperation(
        provider_key="vertex",
        operation_id=submitted.operation_id,
        status=ProviderOperationStatus.COMPLETED,
        items=submitted.items,
        input_uri=submitted.input_uri,
        output_uri=submitted.output_uri,
        results=(
            ImageBatchItemResult(
                item_key="beat-1",
                request_fingerprint=request.request_fingerprint,
                result=result,
            ),
        ),
    )

    durable = await runner.reconcile(submitted)

    assert durable is not None
    assert durable.checksum == checksum
    stored = await storage.find(durable.storage_key)
    assert stored is not None
    assert stored.metadata["execution-mode"] == "batch"
    assert stored.metadata["request-fingerprint"] == request.request_fingerprint
    assert len(repository.completions) == 1
    assert len(repository.assets) == 1


def test_partition_batches_splits_duplicate_provider_bodies() -> None:
    items = [
        ImageBatchItem("beat-2", _request()),
        ImageBatchItem("beat-1", _request()),
    ]

    batches = _partition_batches(items, max_items=50)

    assert [[item.item_key for item in batch] for batch in batches] == [
        ["beat-1"],
        ["beat-2"],
    ]
