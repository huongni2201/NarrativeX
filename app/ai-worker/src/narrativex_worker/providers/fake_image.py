"""Deterministic local image provider used by full-stack E2E."""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from io import BytesIO

from PIL import Image, ImageDraw

from narrativex_worker.providers.image import (
    ImageBatchItem,
    ImageBatchItemResult,
    ImageBatchOperation,
    ImageGenerationRequest,
    ImageGenerationResult,
    ImageProviderOperation,
    batch_fingerprint,
)
from narrativex_worker.schema import ModerationDecision, ProviderOperationStatus


class FakeImageProvider:
    provider_key = "fake-image"

    async def submit_batch(self, items: Sequence[ImageBatchItem]) -> ImageBatchOperation:
        results = tuple(
            ImageBatchItemResult(
                item_key=item.item_key,
                request_fingerprint=item.request.request_fingerprint,
                result=self._result(item),
            )
            for item in items
        )
        return ImageBatchOperation(
            provider_key=self.provider_key,
            operation_id=f"fake-image-{batch_fingerprint(items)[:16]}",
            status=ProviderOperationStatus.COMPLETED,
            items=tuple(items),
            results=results,
        )

    async def reconcile_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation:
        return operation

    async def recover_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation:
        return operation

    async def submit(self, request: ImageGenerationRequest) -> ImageProviderOperation:
        operation = await self.submit_batch((ImageBatchItem("single", request),))
        item = operation.results[0]
        return ImageProviderOperation(
            provider_key=operation.provider_key,
            operation_id=operation.operation_id,
            status=operation.status,
            result=item.result,
            error_code=item.error_code,
            error_detail=item.error_detail,
        )

    async def reconcile(self, operation: ImageProviderOperation) -> ImageProviderOperation:
        return operation

    def get_capabilities(self) -> object:
        return {"provider": self.provider_key, "supports_image_generation": True}

    @staticmethod
    def _result(item: ImageBatchItem) -> ImageGenerationResult:
        dimensions = {
            "16:9": (1280, 720),
            "9:16": (720, 1280),
            "1:1": (1024, 1024),
            "4:3": (1024, 768),
            "3:4": (768, 1024),
        }
        width, height = dimensions.get(item.request.aspect_ratio.value, (1280, 720))
        seed = hashlib.sha256(item.request.request_fingerprint.encode()).digest()
        image = Image.new("RGB", (width, height), (seed[0], seed[1], seed[2]))
        ImageDraw.Draw(image).text((32, 32), "NarrativeX E2E", fill="white")
        buffer = BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        content = buffer.getvalue()
        return ImageGenerationResult(
            mime_type="image/png",
            content=content,
            width=width,
            height=height,
            moderation=ModerationDecision.SAFE,
            result_fingerprint=hashlib.sha256(content).hexdigest(),
            provider_metadata={"mode": "fake"},
        )
