"""Safe default adapter: prevents accidental fake production success."""

from narrativex_worker.analysis_execution import ChapterAnalysisExecutionContext
from narrativex_worker.providers.ports import (
    LlmProvider,
    ProviderCapabilities,
    ProviderOperation,
)
from narrativex_worker.schema import ChapterAnalysisRequest


class ProviderNotConfiguredError(RuntimeError):
    """Raised when a real provider adapter is not configured."""


class DisabledProvider(LlmProvider):
    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(provider_key="disabled", supports_story_analysis=False)

    async def submit(
        self,
        request: ChapterAnalysisRequest,
        *,
        execution: ChapterAnalysisExecutionContext | None = None,
    ) -> ProviderOperation:
        del request, execution
        raise ProviderNotConfiguredError("No real AI provider is configured")

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        del operation
        raise ProviderNotConfiguredError("No real AI provider is configured")

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        del operation
        raise ProviderNotConfiguredError("No real AI provider is configured")
