"""Public image-generation repository composition."""

from narrativex_worker.image_generation_repository.implementation import (
    ImageGenerationRepository as ImageGenerationRepositoryImplementation,
)
from narrativex_worker.image_generation_repository.operation_facade import (
    ImageProviderOperationFacadeMixin,
)
from narrativex_worker.image_generation_repository.references import ImageReferenceFacadeMixin


class ImageGenerationRepository(
    ImageReferenceFacadeMixin,
    ImageProviderOperationFacadeMixin,
    ImageGenerationRepositoryImplementation,
):
    """Public facade with immutable references and paid-operation recovery invariants."""
