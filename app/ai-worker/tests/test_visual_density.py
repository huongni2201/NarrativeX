import pytest

from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    SceneAnalysis,
    VisualBeatAnalysis,
)
from narrativex_worker.visual_density import (
    HARD_MAX_VISUAL_BEAT_MS,
    TARGET_VISUAL_BEAT_MS,
    minimum_visual_beats,
    target_visual_beats,
    validate_visual_beat_density,
)


def _request(*, narration_duration_ms: int | None = None) -> ChapterAnalysisRequest:
    return ChapterAnalysisRequest(
        project_id="00000000-0000-4000-8000-000000000001",
        story_version_id="00000000-0000-4000-8000-000000000002",
        chapter_id="00000000-0000-4000-8000-000000000003",
        chapter_row_version=0,
        source_hash="0" * 64,
        source_text="word " * 200,
        narration_duration_ms=narration_duration_ms,
    )


def _result(count: int) -> ChapterAnalysisResult:
    return ChapterAnalysisResult(
        scenes=[
            SceneAnalysis(
                title="Scene",
                visual_beats=[
                    VisualBeatAnalysis(
                        title=f"Beat {index}",
                        visual_intent=f"Moment {index}",
                        source_anchor=f"anchor {index}",
                    )
                    for index in range(count)
                ],
            )
        ]
    )


def test_ten_minute_narration_requires_at_least_sixty_beats_and_targets_eighty() -> None:
    assert HARD_MAX_VISUAL_BEAT_MS == 10_000
    assert TARGET_VISUAL_BEAT_MS == 7_500
    assert minimum_visual_beats(600_000) == 60
    assert target_visual_beats(600_000) == 80


def test_actual_narration_duration_overrides_source_text_estimate() -> None:
    request = _request(narration_duration_ms=600_000)
    assert request.narration_duration_ms == 600_000


def test_under_dense_storyboard_is_rejected_before_activation() -> None:
    with pytest.raises(ValueError, match="at least 60 visual beats"):
        validate_visual_beat_density(_request(narration_duration_ms=600_000), _result(28))


def test_storyboard_at_hard_floor_is_accepted() -> None:
    validate_visual_beat_density(_request(narration_duration_ms=600_000), _result(60))
