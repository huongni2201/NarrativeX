from collections.abc import Sequence

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.image import (
    BatchImageGenerationProvider,
    ImageBatchItem,
    ImageBatchOperation,
    ImageProviderOperation,
)
from narrativex_worker.providers.vertex_image_batch import VertexBatchImageProvider
from narrativex_worker.providers.fake_image import FakeImageProvider
from narrativex_worker.schema import ProviderOperationStatus


class DisabledImageProvider:
    def get_capabilities(self) -> object:
        from narrativex_worker.providers.ports import ProviderCapabilities

        return ProviderCapabilities(
            "disabled", supports_story_analysis=False, supports_image_generation=False
        )

    async def submit(self, request: object) -> ImageProviderOperation:
        del request
        return ImageProviderOperation(
            "disabled", None, ProviderOperationStatus.FAILED, error_code="PROVIDER_UNAVAILABLE"
        )

    async def reconcile(self, operation: ImageProviderOperation) -> ImageProviderOperation:
        return operation

    async def submit_batch(self, items: Sequence[ImageBatchItem]) -> ImageBatchOperation:
        return ImageBatchOperation(
            provider_key="disabled",
            operation_id=None,
            status=ProviderOperationStatus.FAILED,
            items=tuple(items),
            error_code="PROVIDER_UNAVAILABLE",
        )

    async def reconcile_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation:
        return operation

    async def recover_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation:
        return operation


def create_image_provider(settings: WorkerSettings) -> BatchImageGenerationProvider:
    if settings.image_provider_mode == "fake":
        return FakeImageProvider()
    if settings.image_provider_mode == "vertex":
        return VertexBatchImageProvider(settings)
    return DisabledImageProvider()
