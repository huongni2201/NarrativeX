"""Deterministic analysis provider for the full-stack E2E profile."""

from narrativex_worker.providers.ports import ProviderCapabilities, ProviderEstimate, ProviderOperation
from narrativex_worker.schema import ChapterAnalysisRequest, ChapterAnalysisResult, ProviderOperationStatus, SceneAnalysis, VisualBeatAnalysis


class FakeAnalysisProvider:
    provider_key = "fake-analysis"

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(provider_key=self.provider_key, supports_story_analysis=True)

    def estimate(self, request: ChapterAnalysisRequest) -> ProviderEstimate:
        del request
        return ProviderEstimate(min_cost=0, max_cost=0)

    async def submit(self, request: ChapterAnalysisRequest) -> ProviderOperation:
        result = ChapterAnalysisResult(
            scenes=[
                SceneAnalysis(
                    title="E2E opening scene",
                    narration=request.source_text,
                    visual_beats=[
                        VisualBeatAnalysis(
                            title="E2E opening frame",
                            visual_intent="A cinematic establishing frame for the chapter opening.",
                        )
                    ],
                )
            ]
        )
        return ProviderOperation(
            provider_key=self.provider_key,
            operation_id=f"fake-analysis-{request.chapter_id}-{request.chapter_row_version}",
            status=ProviderOperationStatus.COMPLETED,
            result=result,
        )

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        return operation

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        return operation
