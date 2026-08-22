"""Crash-replayable batch-only image generation orchestration."""

import hashlib
from typing import Any

from narrativex_worker.media_repository import DurableMediaResult
from narrativex_worker.narration.storage import MediaStorage
from narrativex_worker.providers.image import (
    BatchImageGenerationProvider,
    ImageBatchItem,
    ImageBatchItemResult,
    ImageBatchOperation,
    ImageGenerationRequest,
    ImageGenerationResult,
)
from narrativex_worker.schema import ModerationDecision, ProviderOperationStatus


class ImageGenerationUnknownError(RuntimeError):
    pass


class ImageGenerationBlockedError(RuntimeError):
    pass


class ImageGenerationPendingError(RuntimeError):
    """A batch was submitted and must be persisted/reconciled by the durable caller."""

    def __init__(self, operation: ImageBatchOperation) -> None:
        super().__init__("image batch is pending provider reconciliation")
        self.operation = operation


class ImageGenerationProviderRejectedError(ImageGenerationBlockedError):
    """A provider rejected this image request; unrelated scene items may continue."""

    code = "PROVIDER_REJECTED"


class ImageGenerationRunner:
    """Submit and reconcile one image through the asynchronous batch provider path.

    Even a singleton image request is wrapped in ``ImageBatchItem`` and sent through
    ``submit_batch``. ``run`` intentionally does not poll in memory: if the provider returns a
    non-terminal batch, the returned operation is attached to ``ImageGenerationPendingError`` so
    the durable executor can persist the provider job name and reconcile it after a crash/restart.
    """

    def __init__(
        self,
        provider: BatchImageGenerationProvider,
        storage: MediaStorage,
        repository: Any,
    ) -> None:
        self.provider = provider
        self.storage = storage
        self.repository = repository

    async def submit(self, item_key: str, request: ImageGenerationRequest) -> ImageBatchOperation:
        operation = await self.provider.submit_batch((ImageBatchItem(item_key, request),))
        if operation.status is ProviderOperationStatus.UNKNOWN:
            raise ImageGenerationUnknownError("image batch submission outcome is unknown")
        if operation.status is ProviderOperationStatus.FAILED:
            raise RuntimeError(operation.error_code or "IMAGE_BATCH_PROVIDER_FAILED")
        return operation

    async def submit_batch(self, items: tuple[ImageBatchItem, ...]) -> ImageBatchOperation:
        operation = await self.provider.submit_batch(items)
        if operation.status is ProviderOperationStatus.UNKNOWN:
            raise ImageGenerationUnknownError("image batch submission outcome is unknown")
        if operation.status is ProviderOperationStatus.FAILED:
            raise RuntimeError(operation.error_code or "IMAGE_BATCH_PROVIDER_FAILED")
        return operation

    async def reconcile_batch(
        self, operation: ImageBatchOperation
    ) -> tuple[DurableMediaResult, ...] | None:
        resolved = await self.provider.reconcile_batch(operation)
        if resolved.status is ProviderOperationStatus.UNKNOWN:
            raise ImageGenerationUnknownError("image batch reconciliation outcome is unknown")
        if resolved.status in {
            ProviderOperationStatus.RESERVED,
            ProviderOperationStatus.SUBMITTED,
            ProviderOperationStatus.RUNNING,
        }:
            return None
        if resolved.status is ProviderOperationStatus.FAILED:
            raise RuntimeError(resolved.error_code or "IMAGE_BATCH_PROVIDER_FAILED")
        if resolved.status is not ProviderOperationStatus.COMPLETED:
            raise RuntimeError("IMAGE_BATCH_INVALID_STATE")
        return await self.materialize_batch(resolved)

    async def reconcile(self, operation: ImageBatchOperation) -> DurableMediaResult | None:
        results = await self.reconcile_batch(operation)
        return results[0] if results else None

    async def run(self, item_key: str, request: ImageGenerationRequest) -> DurableMediaResult:
        operation = await self.submit(item_key, request)
        if operation.status is ProviderOperationStatus.COMPLETED:
            materialized = await self.materialize_batch(operation)
            return materialized[0]
        raise ImageGenerationPendingError(operation)

    async def materialize_batch(
        self, operation: ImageBatchOperation, *, durable_operation_id: int | None = None
    ) -> tuple[DurableMediaResult, ...]:
        if len(operation.items) != len(operation.results):
            raise RuntimeError("BATCH_ITEM_CORRELATION_FAILED")
        if len({result.item_key for result in operation.results}) != len(operation.results):
            raise RuntimeError("BATCH_ITEM_CORRELATION_FAILED")
        by_key = {item.item_key: item for item in operation.items}
        if set(by_key) != {result.item_key for result in operation.results}:
            raise RuntimeError("BATCH_ITEM_CORRELATION_FAILED")
        materialized: list[DurableMediaResult] = []
        for item_result in operation.results:
            item = by_key[item_result.item_key]
            if item_result.request_fingerprint != item.request.request_fingerprint:
                raise RuntimeError("BATCH_ITEM_CORRELATION_FAILED")
            if item_result.error_code == ImageGenerationProviderRejectedError.code:
                mark_failed = getattr(self.repository, "mark_failed", None)
                if mark_failed is None:
                    raise ImageGenerationProviderRejectedError(
                        item_result.error_detail or "provider moderation rejected this image"
                    )
                await mark_failed(
                    item.item_key,
                    item.request.request_fingerprint,
                    item_result.error_code,
                )
                continue
            if item_result.result is None:
                mark_failed = getattr(self.repository, "mark_failed", None)
                if mark_failed is None:
                    raise RuntimeError(item_result.error_code or "IMAGE_BATCH_ITEM_FAILED")
                await mark_failed(
                    item.item_key,
                    item.request.request_fingerprint,
                    item_result.error_code or "IMAGE_BATCH_ITEM_FAILED",
                )
                continue
            materialized.append(
                await self._materialize(
                    item.item_key,
                    item.request,
                    item_result.result,
                    operation_id=durable_operation_id,
                    provider_operation_id=operation.operation_id,
                )
            )
        return tuple(materialized)

    async def _materialize_completed_batch(
        self, operation: ImageBatchOperation
    ) -> DurableMediaResult:
        if len(operation.items) != 1:
            raise ValueError("single-image runner received a multi-item batch")
        item = operation.items[0]
        item_result = _find_item_result(operation, item.item_key)
        if item_result.error_code == ImageGenerationProviderRejectedError.code:
            raise ImageGenerationProviderRejectedError(
                item_result.error_detail or "provider moderation rejected this image"
            )
        if item_result.result is None:
            raise RuntimeError(item_result.error_code or "IMAGE_BATCH_ITEM_FAILED")
        return await self._materialize(
            item.item_key,
            item.request,
            item_result.result,
            operation_id=None,
            provider_operation_id=operation.operation_id,
        )

    async def _materialize(
        self,
        item_key: str,
        request: ImageGenerationRequest,
        result: ImageGenerationResult,
        *,
        operation_id: int | None,
        provider_operation_id: str | None,
    ) -> DurableMediaResult:
        if result.moderation is ModerationDecision.BLOCK:
            raise ImageGenerationProviderRejectedError("provider moderation rejected this image")
        checksum = result.result_fingerprint
        if checksum != hashlib.sha256(result.content).hexdigest():
            raise ValueError("provider result fingerprint does not match image bytes")
        storage_key = f"private/provider-results/images/{checksum}"
        stored = await self.storage.put_immutable(
            storage_key=storage_key,
            content=result.content,
            checksum=checksum,
            mime_type=result.mime_type,
            metadata={
                "kind": "provider-result",
                "request-fingerprint": request.request_fingerprint,
                "execution-mode": "batch",
            },
        )
        durable = DurableMediaResult(
            storage_key, stored.checksum, stored.mime_type, result.width, result.height
        )
        finalize = getattr(self.repository, "finalize_image_result", None)
        if finalize is not None:
            await finalize(
                operation_id=operation_id,
                item_key=item_key,
                request_fingerprint=request.request_fingerprint,
                provider_operation_id=provider_operation_id,
                provider_result=result,
                stored=durable,
            )
        else:
            await self.repository.persist_provider_completion(
                item_key, request.request_fingerprint, durable
            )
            await self.repository.materialize_asset(
                item_key, request.request_fingerprint, result, durable
            )
        return durable


def _find_item_result(operation: ImageBatchOperation, item_key: str) -> ImageBatchItemResult:
    matches = [result for result in operation.results if result.item_key == item_key]
    if len(matches) != 1:
        raise RuntimeError("IMAGE_BATCH_ITEM_RESULT_MISSING")
    return matches[0]
