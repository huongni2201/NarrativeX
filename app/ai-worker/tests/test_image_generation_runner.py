import hashlib
from dataclasses import dataclass

import pytest

from narrativex_worker.image_generation_runner import (
    ImageGenerationPendingError,
    ImageGenerationRunner,
)
from narrativex_worker.media_repository import DurableMediaResult
from narrativex_worker.providers.image import (
    ImageBatchItem,
    ImageBatchItemResult,
    ImageBatchOperation,
    ImageGenerationRequest,
    ImageGenerationResult,
)
from narrativex_worker.schema import (
    ImageAspectRatio,
    ImageQualityTier,
    ModerationDecision,
    ProviderOperationStatus,
)


@dataclass(frozen=True)
class _Stored:
    checksum: str
    mime_type: str


class _Storage:
    def __init__(self) -> None:
        self.puts: list[dict[str, object]] = []

    async def put_immutable(self, **kwargs: object) -> _Stored:
        self.puts.append(kwargs)
        return _Stored(str(kwargs["checksum"]), str(kwargs["mime_type"]))


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

    async def submit(self, request: object) -> object:
        raise AssertionError("batch-only runner must never call online submit")

    async def reconcile(self, operation: object) -> object:
        raise AssertionError("batch-only runner must never call online reconcile")

    async def submit_batch(self, items: tuple[ImageBatchItem, ...]) -> ImageBatchOperation:
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
    runner = ImageGenerationRunner(provider, _Storage(), _Repository())

    with pytest.raises(ImageGenerationPendingError) as caught:
        await runner.run("beat-1", _request())

    assert provider.submitted is not None
    assert len(provider.submitted) == 1
    assert provider.submitted[0].item_key == "beat-1"
    assert caught.value.operation.operation_id is not None


@pytest.mark.asyncio
async def test_reconcile_materializes_completed_batch_result() -> None:
    provider = _BatchProvider()
    storage = _Storage()
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
    assert len(storage.puts) == 1
    assert storage.puts[0]["metadata"] == {
        "kind": "provider-result",
        "request-fingerprint": request.request_fingerprint,
        "execution-mode": "batch",
    }
    assert len(repository.completions) == 1
    assert len(repository.assets) == 1
