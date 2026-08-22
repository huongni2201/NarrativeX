"""Worker-side orchestration boundary for durable jobs."""

import logging

from narrativex_worker.providers.ports import LlmProvider, ProviderOperation
from narrativex_worker.schema import ChapterAnalysisRequest, ProviderOperationStatus

logger = logging.getLogger("narrativex.worker.service")


class WorkerService:
    def __init__(self, provider: LlmProvider) -> None:
        self.provider = provider

    async def submit_chapter_analysis(self, request: ChapterAnalysisRequest) -> ProviderOperation:
        logger.info(
            "Submitting chapter analysis: storyVersionId=%s, chapterId=%s",
            request.story_version_id,
            request.chapter_id,
        )
        return await self.provider.submit(request)

    async def reconcile_chapter_analysis(self, operation: ProviderOperation) -> ProviderOperation:
        logger.info("Reconciling chapter analysis operation=%s", operation.operation_name)
        status = await self.provider.get_status(operation)
        if status.status is not ProviderOperationStatus.UNKNOWN and status.result is not None:
            return status
        return await self.provider.reconcile(status)
