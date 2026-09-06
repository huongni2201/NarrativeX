"""Deterministic analysis provider for the full-stack E2E profile."""

from narrativex_worker.providers.ports import ProviderCapabilities, ProviderOperation
from narrativex_worker.schema import (
    ActionPhase,
    CameraAngle,
    CameraMovement,
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    LensMm,
    MovementIntensity,
    ProviderOperationStatus,
    SceneAnalysis,
    ShotSize,
    VisualBeatAnalysis,
    VisualDirection,
)


class FakeAnalysisProvider:
    provider_key = "fake-analysis"

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(provider_key=self.provider_key, supports_story_analysis=True)

    async def submit(self, request: ChapterAnalysisRequest) -> ProviderOperation:
        anchor = request.source_text[: min(120, len(request.source_text))]
        result = ChapterAnalysisResult(
            scenes=[
                SceneAnalysis(
                    title="E2E opening scene",
                    narration=request.source_text,
                    visual_beats=[
                        VisualBeatAnalysis(
                            title="E2E opening frame",
                            visual_intent="A readable establishing frame for the chapter opening.",
                            source_anchor=anchor,
                            visual_direction=VisualDirection(
                                shot_size=ShotSize.ESTABLISHING,
                                camera_angle=CameraAngle.EYE_LEVEL,
                                lens_mm=LensMm.MM_24,
                                focus_target="chapter opening subject",
                                action_phase=ActionPhase.AFTER,
                                subject_placement="primary subject in the middle third",
                                foreground=None,
                                background="source-grounded chapter environment",
                                motivated_light="soft source-grounded ambient light",
                                palette="neutral balanced palette",
                                camera_movement=CameraMovement.NONE,
                                movement_direction=None,
                                movement_intensity=MovementIntensity.SUBTLE,
                                crop_safe_area="modest crop room on all sides",
                            ),
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
