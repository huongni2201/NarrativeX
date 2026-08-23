"""Stable facade for the chapter-analysis worker repository."""

from narrativex_worker.repository.implementation import (
    ALLOWED_PROVIDER_TRANSITIONS,
    ClaimedChapterAnalysisJob,
    DurableProviderOperation,
    ProviderOperationInvalidTransitionError,
    ProviderOperationStateConflictError,
    ProviderResultConflictError,
    provider_request_fingerprint,
)
from narrativex_worker.repository.implementation import (
    WorkerRepository as WorkerRepositoryImplementation,
)


class WorkerRepository(WorkerRepositoryImplementation):
    """Public repository facade retained for existing worker consumers."""


__all__ = [
    "ALLOWED_PROVIDER_TRANSITIONS",
    "ClaimedChapterAnalysisJob",
    "DurableProviderOperation",
    "ProviderOperationInvalidTransitionError",
    "ProviderOperationStateConflictError",
    "ProviderResultConflictError",
    "WorkerRepository",
    "provider_request_fingerprint",
]
