"""Worker-side orchestration boundary for durable jobs."""

from narrativex_worker.prompting import build_chapter_analysis_prompt
from narrativex_worker.providers.ports import LlmProvider, ProviderOperation
from narrativex_worker.schema import ChapterAnalysisRequest


class WorkerService:
    def __init__(self, provider: LlmProvider) -> None:
        self.provider = provider

    async def submit_chapter_analysis(
        self, request: ChapterAnalysisRequest
    ) -> ProviderOperation:
        # Building the prompt is deterministic and testable; submission remains adapter-owned.
        build_chapter_analysis_prompt(request)
        return await self.provider.submit(request)
