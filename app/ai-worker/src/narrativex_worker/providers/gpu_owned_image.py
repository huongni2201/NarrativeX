"""Global-GPU wrapper for local image generation providers."""

from __future__ import annotations

from collections.abc import Sequence
from typing import cast

from narrativex_worker.config import WorkerSettings
from narrativex_worker.gpu_ownership import GpuOwner, gpu_lease
from narrativex_worker.providers.image import (
    BatchImageGenerationProvider,
    ImageBatchItem,
    ImageBatchOperation,
)


class GpuOwnedBatchImageProvider:
    """Acquire the global RTX ownership boundary before enqueuing ComfyUI GPU work."""

    def __init__(self, settings: WorkerSettings, inner: BatchImageGenerationProvider) -> None:
        self.settings = settings
        self.inner = inner

    def get_capabilities(self) -> object:
        return self.inner.get_capabilities()

    async def submit_batch(self, items: Sequence[ImageBatchItem]) -> ImageBatchOperation:
        # Only submission needs to establish RealVisXL ownership. Once ComfyUI has accepted the
        # prompt, any later owner transition will drain its queue before unloading the model.
        async with gpu_lease(self.settings, GpuOwner.REALVISXL):
            return await self.inner.submit_batch(items)

    async def reconcile_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation:
        return await self.inner.reconcile_batch(operation)

    async def recover_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation:
        recover = getattr(self.inner, "recover_batch", None)
        if recover is None:
            return operation
        return cast(ImageBatchOperation, await recover(operation))


    async def aclose(self) -> None:
        close = getattr(self.inner, "aclose", None)
        if close is not None:
            await close()


__all__ = ["GpuOwnedBatchImageProvider"]
