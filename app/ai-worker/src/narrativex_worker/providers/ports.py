"""Provider-agnostic ports. Concrete SDKs must live in adapters."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    ProviderOperationStatus,
)


class ProviderSubmissionUnknownError(RuntimeError):
    """The provider may have accepted work; never convert this into a blind retry."""


@dataclass(frozen=True)
class ProviderCapabilities:
    provider_key: str
    supports_story_analysis: bool
    supports_image_generation: bool = False
    supports_operation_reconciliation: bool = False


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


class LlmProvider(Protocol):
    """Port used by orchestration; no vendor SDK leaks into worker schemas."""

    def get_capabilities(self) -> ProviderCapabilities: ...

    async def submit(self, request: ChapterAnalysisRequest) -> ProviderOperation: ...

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation: ...

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation: ...
