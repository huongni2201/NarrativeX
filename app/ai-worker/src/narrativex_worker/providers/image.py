"""Provider-neutral image generation contracts.

Vendor SDK response objects are deliberately not allowed across this module boundary.
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Protocol

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


class ImageGenerationProvider(Protocol):
    def get_capabilities(self) -> object: ...

    async def submit(self, request: ImageGenerationRequest) -> ImageProviderOperation: ...

    async def reconcile(self, operation: ImageProviderOperation) -> ImageProviderOperation: ...
