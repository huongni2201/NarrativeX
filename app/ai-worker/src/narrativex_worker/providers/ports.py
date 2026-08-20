"""Provider-agnostic ports. Concrete SDKs must live in adapters."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from narrativex_worker.media import I2vResolution
from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    ProviderOperationStatus,
)


class ProviderSubmissionRejectedError(RuntimeError):
    """The provider boundary was not crossed; the operation can fail definitively."""


class ProviderSubmissionUnknownError(RuntimeError):
    """The provider may have accepted work; never convert this into a blind retry."""


@dataclass(frozen=True)
class ProviderCapabilities:
    provider_key: str
    supports_story_analysis: bool
    supports_image_generation: bool = False
    supports_video_generation: bool = False
    supports_operation_reconciliation: bool = False


@dataclass(frozen=True)
class ProviderEstimate:
    min_cost: float
    max_cost: float
    currency: str = "USD"


@dataclass(frozen=True)
class ProviderTokenUsage:
    prompt_tokens: int
    candidate_tokens: int
    thought_tokens: int = 0
    cached_input_tokens: int = 0
    tool_input_tokens: int = 0
    total_tokens: int = 0
    traffic_type: str | None = None


@dataclass(frozen=True)
class ProviderPricingSnapshot:
    catalog_version: str
    model_key: str
    location: str
    pricing_mode: str
    input_usd_per_million: Decimal
    cached_input_usd_per_million: Decimal
    output_usd_per_million: Decimal


@dataclass(frozen=True)
class ProviderBilling:
    actual_cost: Decimal
    currency: str
    usage: ProviderTokenUsage
    pricing: ProviderPricingSnapshot


@dataclass(frozen=True)
class ProviderOperation:
    provider_key: str
    operation_id: str | None
    status: ProviderOperationStatus
    result: ChapterAnalysisResult | None = None
    billing: ProviderBilling | None = None


@dataclass(frozen=True)
class VideoGenerationRequest:
    """Resolved I2V request. Credentials and raw story text never belong in this payload."""

    request_id: str
    image_url: str
    prompt: str
    duration_seconds: int
    resolution: I2vResolution
    negative_prompt: str | None = None


@dataclass(frozen=True)
class VideoProviderOperation:
    provider_key: str
    operation_id: str | None
    status: ProviderOperationStatus
    output_url: str | None = None
    error_code: str | None = None


class LlmProvider(Protocol):
    """Port used by orchestration; no vendor SDK leaks into worker schemas."""

    def get_capabilities(self) -> ProviderCapabilities: ...

    def estimate(self, request: ChapterAnalysisRequest) -> ProviderEstimate: ...

    async def submit(self, request: ChapterAnalysisRequest) -> ProviderOperation: ...

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation: ...

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation: ...


class VideoGenerationProvider(Protocol):
    """Asynchronous image-to-video port used by HYBRID_LOCAL_I2V orchestration."""

    def get_capabilities(self) -> ProviderCapabilities: ...

    async def submit(self, request: VideoGenerationRequest) -> VideoProviderOperation: ...

    async def get_status(self, operation: VideoProviderOperation) -> VideoProviderOperation: ...

    async def reconcile(self, operation: VideoProviderOperation) -> VideoProviderOperation: ...
