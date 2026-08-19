"""Worker-side orchestration boundary for durable jobs."""

from narrativex_worker.providers.ports import LlmProvider, ProviderOperation
from narrativex_worker.schema import ChapterAnalysisRequest, ProviderOperationStatus


class WorkerService:
    def __init__(self, provider: LlmProvider) -> None:
        self.provider = provider

    async def submit_chapter_analysis(self, request: ChapterAnalysisRequest) -> ProviderOperation:
        return await self.provider.submit(request)

    async def reconcile_chapter_analysis(self, operation: ProviderOperation) -> ProviderOperation:
        status = await self.provider.get_status(operation)
        if status.status is not ProviderOperationStatus.UNKNOWN and status.result is not None:
            return status
        return await self.provider.reconcile(status)
