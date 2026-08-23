"""Stable image-generation repository facade."""

from narrativex_worker.image_generation_repository.implementation import (
    ClaimedImageGenerationItem,
    ClaimedImageGenerationJob,
    DurableImageOperation,
    ImageGenerationLeaseLostError,
)
from narrativex_worker.image_generation_repository.implementation import (
    ImageGenerationRepository as ImageGenerationRepositoryImplementation,
)


class ImageGenerationRepository(ImageGenerationRepositoryImplementation):
    """Public facade retained for existing worker and test consumers."""


__all__ = [
    "ClaimedImageGenerationItem",
    "ClaimedImageGenerationJob",
    "DurableImageOperation",
    "ImageGenerationLeaseLostError",
    "ImageGenerationRepository",
]
