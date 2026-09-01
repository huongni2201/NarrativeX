"""Shared visual-beat density policy for analysis planning and admission."""

import math
import re

from narrativex_worker.schema import ChapterAnalysisRequest, ChapterAnalysisResult

_WORD_PATTERN = re.compile(r"\w+", re.UNICODE)
_NARRATION_WORDS_PER_MINUTE = 140
TARGET_VISUAL_BEAT_MS = 7_500
HARD_MAX_VISUAL_BEAT_MS = 10_000


def estimated_narration_duration_ms(source_text: str) -> int:
    word_count = max(1, len(_WORD_PATTERN.findall(source_text)))
    return max(15_000, round(word_count * 60_000 / _NARRATION_WORDS_PER_MINUTE))


def planning_duration_ms(request: ChapterAnalysisRequest) -> int:
    actual = getattr(request, "narration_duration_ms", None)
    if isinstance(actual, int) and actual > 0:
        return actual
    return estimated_narration_duration_ms(request.source_text)


def minimum_visual_beats(duration_ms: int) -> int:
    return max(2, math.ceil(max(1, duration_ms) / HARD_MAX_VISUAL_BEAT_MS))


def target_visual_beats(duration_ms: int) -> int:
    return max(2, math.ceil(max(1, duration_ms) / TARGET_VISUAL_BEAT_MS))


def maximum_visual_beats(duration_ms: int) -> int:
    return max(target_visual_beats(duration_ms), math.ceil(target_visual_beats(duration_ms) * 1.15))


def validate_visual_beat_density(
    request: ChapterAnalysisRequest,
    result: ChapterAnalysisResult,
) -> None:
    duration_ms = planning_duration_ms(request)
    minimum = minimum_visual_beats(duration_ms)
    actual = sum(len(scene.visual_beats) for scene in result.scenes)
    if actual < minimum:
        raise ValueError(
            f"Storyboard is under-dense: expected at least {minimum} visual beats for "
            f"{duration_ms}ms narration planning duration, received {actual}"
        )
