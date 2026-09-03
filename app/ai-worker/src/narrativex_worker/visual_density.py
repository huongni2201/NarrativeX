"""Shared visual-beat density policy for analysis planning and admission."""

import math
import re
from contextvars import ContextVar
from typing import Any

from pydantic import Field

from narrativex_worker.schema import ChapterAnalysisRequest, ChapterAnalysisResult

_WORD_PATTERN = re.compile(r"\w+", re.UNICODE)
# Conservative pre-narration estimate. Actual narration duration is preferred whenever available.
_NARRATION_WORDS_PER_MINUTE = 100
TARGET_VISUAL_BEAT_MS = 7_500
HARD_MAX_VISUAL_BEAT_MS = 10_000
MAX_VISUAL_BEATS_OVER_TARGET_RATIO = 1.15
_ANALYSIS_PLANNING_DURATION_MS: ContextVar[int | None] = ContextVar(
    "analysis-planning-duration-ms", default=None
)


class ChapterAnalysisPlanningRequest(ChapterAnalysisRequest):
    """Chapter request enriched with a duration snapshot used consistently by one analysis job."""

    narration_duration_ms: int | None = Field(default=None, gt=0)


def bind_planning_duration(duration_ms: int | None) -> None:
    """Bind a claim's narration snapshot so the processing task inherits the same duration."""
    _ANALYSIS_PLANNING_DURATION_MS.set(duration_ms if duration_ms and duration_ms > 0 else None)


def estimated_narration_duration_ms(
    source_text: str,
    *,
    words_per_minute: int = _NARRATION_WORDS_PER_MINUTE,
) -> int:
    bound_duration = _ANALYSIS_PLANNING_DURATION_MS.get()
    if isinstance(bound_duration, int) and bound_duration > 0:
        return bound_duration
    if words_per_minute <= 0:
        raise ValueError("words_per_minute must be positive")
    word_count = max(1, len(_WORD_PATTERN.findall(source_text)))
    return max(1_000, round(word_count * 60_000 / words_per_minute))


def planning_duration_ms(request: ChapterAnalysisRequest) -> int:
    """Prefer the narration snapshot captured for this source, else estimate from source text."""
    narration_duration = getattr(request, "narration_duration_ms", None)
    if isinstance(narration_duration, int) and narration_duration > 0:
        return narration_duration
    return estimated_narration_duration_ms(request.source_text)


def current_planning_duration_ms(source_text: str) -> int:
    """Resolve the task-local narration duration, falling back to source-based estimation."""
    narration_duration = _ANALYSIS_PLANNING_DURATION_MS.get()
    if isinstance(narration_duration, int) and narration_duration > 0:
        return narration_duration
    return estimated_narration_duration_ms(source_text)


def minimum_visual_beats(
    duration_ms: int,
    *,
    hard_max_visual_beat_ms: int = HARD_MAX_VISUAL_BEAT_MS,
) -> int:
    if hard_max_visual_beat_ms <= 0:
        raise ValueError("hard_max_visual_beat_ms must be positive")
    return max(1, math.ceil(max(1, duration_ms) / hard_max_visual_beat_ms))


def target_visual_beats(
    duration_ms: int,
    *,
    target_visual_beat_ms: int = TARGET_VISUAL_BEAT_MS,
) -> int:
    if target_visual_beat_ms <= 0:
        raise ValueError("target_visual_beat_ms must be positive")
    return max(1, math.ceil(max(1, duration_ms) / target_visual_beat_ms))


def maximum_visual_beats(
    duration_ms: int,
    *,
    target_visual_beat_ms: int = TARGET_VISUAL_BEAT_MS,
    max_over_target_ratio: float = MAX_VISUAL_BEATS_OVER_TARGET_RATIO,
) -> int:
    if max_over_target_ratio < 1:
        raise ValueError("max_over_target_ratio must be >= 1")
    target = target_visual_beats(duration_ms, target_visual_beat_ms=target_visual_beat_ms)
    return max(target, math.ceil(target * max_over_target_ratio))


def validate_visual_beat_density(
    result: ChapterAnalysisResult,
    *,
    duration_ms: int,
    hard_max_visual_beat_ms: int = HARD_MAX_VISUAL_BEAT_MS,
    target_visual_beat_ms: int = TARGET_VISUAL_BEAT_MS,
    max_over_target_ratio: float = MAX_VISUAL_BEATS_OVER_TARGET_RATIO,
) -> None:
    minimum = minimum_visual_beats(
        duration_ms,
        hard_max_visual_beat_ms=hard_max_visual_beat_ms,
    )
    maximum = maximum_visual_beats(
        duration_ms,
        target_visual_beat_ms=target_visual_beat_ms,
        max_over_target_ratio=max_over_target_ratio,
    )
    actual = sum(len(scene.visual_beats) for scene in result.scenes)
    if actual < minimum:
        raise ValueError(
            f"Storyboard is under-dense: expected at least {minimum} visual beats for "
            f"{duration_ms}ms narration planning duration, received {actual}"
        )
    if actual > maximum:
        raise ValueError(
            f"Storyboard is over-dense: expected at most {maximum} visual beats for "
            f"{duration_ms}ms narration planning duration, received {actual}"
        )


async def latest_narration_duration_ms(
    connection: Any,
    *,
    chapter_id: object,
    source_hash: str,
) -> int | None:
    """Return authoritative narration duration for the current source snapshot when available."""
    fetchval = getattr(connection, "fetchval", None)
    if not callable(fetchval):
        return None
    value = await fetchval(
        """
        SELECT na.duration_ms
          FROM narration_requests nr
          JOIN narration_assets na ON na.narration_request_id = nr.id
         WHERE nr.chapter_id = $1
           AND nr.source_hash = $2
         ORDER BY nr.created_at DESC, na.created_at DESC, na.id DESC
         LIMIT 1
        """,
        chapter_id,
        source_hash,
    )
    if isinstance(value, int) and value > 0:
        return value
    return None
