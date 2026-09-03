import pytest

from narrativex_worker.schema import ChapterAnalysisResult, SceneAnalysis, VisualBeatAnalysis
from narrativex_worker.visual_density import (
    HARD_MAX_VISUAL_BEAT_MS,
    TARGET_VISUAL_BEAT_MS,
    estimated_narration_duration_ms,
    latest_narration_duration_ms,
    minimum_visual_beats,
    target_visual_beats,
    validate_visual_beat_density,
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


def test_pre_narration_estimate_scales_with_text_units() -> None:
    assert estimated_narration_duration_ms("word " * 1000) == 240_000
    assert estimated_narration_duration_ms("word " * 2000) == 480_000


@pytest.mark.asyncio
async def test_actual_narration_duration_is_preferred_when_available() -> None:
    class Connection:
        async def fetchval(self, query: str, *args: object) -> int:
            assert "narration_assets" in query
            assert args[1] == "a" * 64
            return 600_000

    assert (
        await latest_narration_duration_ms(
            Connection(), chapter_id="chapter-1", source_hash="a" * 64
        )
        == 600_000
    )


def test_under_dense_storyboard_is_rejected_before_activation() -> None:
    with pytest.raises(ValueError, match="at least 60 visual beats"):
        validate_visual_beat_density(_result(28), duration_ms=600_000)


def test_over_dense_storyboard_is_rejected_before_activation() -> None:
    with pytest.raises(ValueError, match="at most 92 visual beats"):
        validate_visual_beat_density(_result(93), duration_ms=600_000)


def test_storyboard_at_hard_floor_is_accepted() -> None:
    validate_visual_beat_density(_result(60), duration_ms=600_000)
