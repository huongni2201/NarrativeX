"""Worker-side orchestration boundary for durable jobs."""

from narrativex_worker.prompting import build_story_analysis_prompt
from narrativex_worker.providers.ports import LlmProvider, ProviderOperation
from narrativex_worker.schema import StoryAnalysisRequest


class WorkerService:
    def __init__(self, provider: LlmProvider) -> None:
        self.provider = provider

    async def submit_story_analysis(self, request: StoryAnalysisRequest) -> ProviderOperation:
        if not request.rights_attested:
            raise ValueError("rights attestation is required before analysis")
        # Building the prompt is deterministic and testable; submission remains adapter-owned.
        build_story_analysis_prompt(request)
        return await self.provider.submit(request)
