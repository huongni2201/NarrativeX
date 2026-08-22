from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.image import ImageGenerationProvider, ImageProviderOperation
from narrativex_worker.providers.vertex_image_batch import VertexBatchImageProvider
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


def create_image_provider(settings: WorkerSettings) -> ImageGenerationProvider:
    if settings.image_provider_mode == "vertex":
        return VertexBatchImageProvider(settings)
    return DisabledImageProvider()
