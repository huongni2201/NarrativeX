"""Base PostgreSQL implementation for the durable SHOT_IMAGE_GENERATE worker.

The public facade layers immutable reference reconstruction and hardened provider-operation
recovery over this base composition.
"""

from narrativex_worker.image_generation_repository.aggregation import ImageAggregationMixin
from narrativex_worker.image_generation_repository.claims import ImageClaimsMixin
from narrativex_worker.image_generation_repository.core import ImageRepositoryCore
from narrativex_worker.image_generation_repository.materialization import ImageMaterializationMixin
from narrativex_worker.image_generation_repository.models import (
    ClaimedImageGenerationItem,
    ClaimedImageGenerationJob,
    DurableImageOperation,
    ImageGenerationLeaseLostError,
)
from narrativex_worker.image_generation_repository.reconciliation import ImageReconciliationMixin
from narrativex_worker.image_generation_repository.submission import ImageSubmissionMixin


class ImageGenerationRepository(
    ImageClaimsMixin,
    ImageSubmissionMixin,
    ImageReconciliationMixin,
    ImageAggregationMixin,
    ImageMaterializationMixin,
    ImageRepositoryCore,
):
    """Internal base implementation retained for recovery-boundary tests."""


__all__ = [
    "ClaimedImageGenerationItem",
    "ClaimedImageGenerationJob",
    "DurableImageOperation",
    "ImageGenerationLeaseLostError",
    "ImageGenerationRepository",
]
