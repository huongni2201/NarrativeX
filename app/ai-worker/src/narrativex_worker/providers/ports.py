"""Provider-agnostic ports. Concrete SDKs must live in adapters."""

from dataclasses import dataclass
from typing import Protocol

from narrativex_worker.schema import ProviderOperationStatus, StoryAnalysisRequest


@dataclass(frozen=True)
class ProviderCapabilities:
    provider_key: str
    supports_story_analysis: bool
    supports_image_generation: bool = False
    supports_video_generation: bool = False


@dataclass(frozen=True)
class ProviderEstimate:
    min_cost: float
    max_cost: float
    currency: str = "USD"


@dataclass(frozen=True)
class ProviderOperation:
    provider_key: str
    operation_id: str | None
    status: ProviderOperationStatus


class LlmProvider(Protocol):
    """Port used by orchestration; no vendor SDK leaks into worker schemas."""

    def get_capabilities(self) -> ProviderCapabilities:
        ...

    def estimate(self, request: StoryAnalysisRequest) -> ProviderEstimate:
        ...

    async def submit(self, request: StoryAnalysisRequest) -> ProviderOperation:
        ...

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        ...

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        ...
