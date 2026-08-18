"""Safe default adapter: prevents accidental fake production success."""

from narrativex_worker.providers.ports import (
    LlmProvider,
    ProviderCapabilities,
    ProviderEstimate,
    ProviderOperation,
)
from narrativex_worker.schema import ChapterAnalysisRequest


class ProviderNotConfiguredError(RuntimeError):
    """Raised when a real provider adapter is not configured."""


class DisabledProvider(LlmProvider):
    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(provider_key="disabled", supports_story_analysis=False)

    def estimate(self, request: ChapterAnalysisRequest) -> ProviderEstimate:
        del request
        raise ProviderNotConfiguredError("No real AI provider is configured")

    async def submit(self, request: ChapterAnalysisRequest) -> ProviderOperation:
        del request
        raise ProviderNotConfiguredError("No real AI provider is configured")

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        del operation
        raise ProviderNotConfiguredError("No real AI provider is configured")

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        del operation
        raise ProviderNotConfiguredError("No real AI provider is configured")
