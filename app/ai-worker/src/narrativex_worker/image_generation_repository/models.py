"""Image-generation repository value objects."""

import uuid
from dataclasses import dataclass

from narrativex_worker.providers.image import ImageBatchItem, ImageGenerationRequest
from narrativex_worker.schema import ProviderOperationStatus


@dataclass(frozen=True)
class ClaimedImageGenerationJob:
    generation_job_id: uuid.UUID
    stage_attempt_id: uuid.UUID
    lease_token: str
    project_id: uuid.UUID
    media_plan_id: uuid.UUID
    worker_id: str


class ImageGenerationLeaseLostError(RuntimeError):
    """Raised when a worker no longer owns the image-generation stage lease."""


@dataclass(frozen=True)
class ClaimedImageGenerationItem:
    id: uuid.UUID
    item_key: str
    visual_beat_id: uuid.UUID
    request: ImageGenerationRequest


@dataclass(frozen=True)
class DurableImageOperation:
    id: uuid.UUID
    stage_attempt_id: uuid.UUID
    provider_key: str
    request_fingerprint: str
    provider_operation_id: str | None
    status: ProviderOperationStatus
    row_version: int
    items: tuple[ImageBatchItem, ...]
    created: bool = False
    worker_id: str | None = None
    lease_token: str | None = None


__all__ = [
    "ClaimedImageGenerationItem",
    "ClaimedImageGenerationJob",
    "DurableImageOperation",
    "ImageGenerationLeaseLostError",
]
