"""Stable narration repository facade."""

from narrativex_worker.narration.repository.implementation import (
    ClaimedNarrationJob,
    DurableNarrationProviderOperation,
    NarrationClaimStateConflictError,
    NarrationProviderStateConflictError,
    segment_request_fingerprint,
)
from narrativex_worker.narration.repository.implementation import (
    NarrationWorkerRepository as NarrationWorkerRepositoryImplementation,
)


class NarrationWorkerRepository(NarrationWorkerRepositoryImplementation):
    """Public facade retained for existing narration consumers."""


__all__ = [
    "ClaimedNarrationJob",
    "DurableNarrationProviderOperation",
    "NarrationClaimStateConflictError",
    "NarrationProviderStateConflictError",
    "NarrationWorkerRepository",
    "segment_request_fingerprint",
]
