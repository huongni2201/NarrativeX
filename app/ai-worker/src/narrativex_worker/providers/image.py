"""Provider-neutral image generation contracts.

Vendor SDK response objects are deliberately not allowed across this module boundary.
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Protocol, Sequence

from narrativex_worker.schema import (
    ImageAspectRatio,
    ImageQualityTier,
    ModerationDecision,
    ProviderOperationStatus,
)


@dataclass(frozen=True)
class ImageGenerationRequest:
    request_fingerprint: str
    prompt: str
    negative_prompt: str | None
    aspect_ratio: ImageAspectRatio
    quality_tier: ImageQualityTier
    provider_key: str
    model_key: str
    location: str
    max_output_bytes: int = 15_000_000


@dataclass(frozen=True)
class ImageGenerationResult:
    mime_type: str
    content: bytes
    width: int
    height: int
    moderation: ModerationDecision
    result_fingerprint: str
    provider_metadata: dict[str, str] = field(default_factory=dict)
    usage: dict[str, int | str] = field(default_factory=dict)
    actual_cost: Decimal | None = None


@dataclass(frozen=True)
class ImageProviderOperation:
    provider_key: str
    operation_id: str | None
    status: ProviderOperationStatus
    result: ImageGenerationResult | None = None
    error_code: str | None = None
    error_detail: str | None = None


@dataclass(frozen=True)
class ImageBatchItem:
    """One provider-neutral image request inside a paid batch operation."""

    item_key: str
    request: ImageGenerationRequest


@dataclass(frozen=True)
class ImageBatchItemResult:
    item_key: str
    request_fingerprint: str
    result: ImageGenerationResult | None = None
    error_code: str | None = None
    error_detail: str | None = None


@dataclass(frozen=True)
class ImageBatchOperation:
    """Durable data needed to reconcile an asynchronous image batch job.

    The caller must persist this operation before releasing the job lease. The adapter never
    blindly re-submits a batch whose submission outcome is ambiguous.
    """

    provider_key: str
    operation_id: str | None
    status: ProviderOperationStatus
    items: tuple[ImageBatchItem, ...]
    input_uri: str | None = None
    output_uri: str | None = None
    results: tuple[ImageBatchItemResult, ...] = ()
    error_code: str | None = None
    error_detail: str | None = None


class ImageGenerationProvider(Protocol):
    def get_capabilities(self) -> object: ...

    async def submit(self, request: ImageGenerationRequest) -> ImageProviderOperation: ...

    async def reconcile(self, operation: ImageProviderOperation) -> ImageProviderOperation: ...


class BatchImageGenerationProvider(ImageGenerationProvider, Protocol):
    async def submit_batch(self, items: Sequence[ImageBatchItem]) -> ImageBatchOperation: ...

    async def reconcile_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation: ...
