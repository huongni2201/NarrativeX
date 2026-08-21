"""Crash-replayable per-beat image generation orchestration."""

import hashlib

from narrativex_worker.media_repository import DurableMediaResult, MediaGenerationRepository
from narrativex_worker.narration.storage import MediaStorage
from narrativex_worker.providers.image import ImageGenerationProvider, ImageGenerationRequest
from narrativex_worker.schema import ModerationDecision, ProviderOperationStatus


class ImageGenerationUnknownError(RuntimeError):
    pass


class ImageGenerationBlockedError(RuntimeError):
    pass


class ImageGenerationRunner:
    def __init__(
        self,
        provider: ImageGenerationProvider,
        storage: MediaStorage,
        repository: MediaGenerationRepository,
    ) -> None:
        self.provider = provider
        self.storage = storage
        self.repository = repository

    async def run(self, item_key: str, request: ImageGenerationRequest) -> DurableMediaResult:
        operation = await self.provider.submit(request)
        if operation.status is ProviderOperationStatus.UNKNOWN:
            raise ImageGenerationUnknownError("image provider submission outcome is unknown")
        if operation.status is not ProviderOperationStatus.COMPLETED or operation.result is None:
            raise RuntimeError(operation.error_code or "IMAGE_PROVIDER_FAILED")
        result = operation.result
        if result.moderation is ModerationDecision.BLOCK:
            raise ImageGenerationBlockedError("provider moderation blocked this image")
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
            },
        )
        durable = DurableMediaResult(
            storage_key, stored.checksum, stored.mime_type, result.width, result.height
        )
        await self.repository.persist_provider_completion(
            item_key, request.request_fingerprint, durable
        )
        await self.repository.materialize_asset(
            item_key, request.request_fingerprint, result, durable
        )
        return durable
