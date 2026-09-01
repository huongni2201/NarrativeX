"""Shared visual-beat density policy for analysis planning and admission."""

import math
import re
from typing import Any

from narrativex_worker.schema import ChapterAnalysisResult

_WORD_PATTERN = re.compile(r"\w+", re.UNICODE)
# Conservative pre-narration estimate. Actual narration duration is preferred whenever available.
_NARRATION_WORDS_PER_MINUTE = 100
TARGET_VISUAL_BEAT_MS = 7_500
HARD_MAX_VISUAL_BEAT_MS = 10_000


def estimated_narration_duration_ms(source_text: str) -> int:
    word_count = max(1, len(_WORD_PATTERN.findall(source_text)))
    return max(15_000, round(word_count * 60_000 / _NARRATION_WORDS_PER_MINUTE))


def minimum_visual_beats(duration_ms: int) -> int:
    return max(2, math.ceil(max(1, duration_ms) / HARD_MAX_VISUAL_BEAT_MS))


def target_visual_beats(duration_ms: int) -> int:
    return max(2, math.ceil(max(1, duration_ms) / TARGET_VISUAL_BEAT_MS))


def maximum_visual_beats(duration_ms: int) -> int:
    target = target_visual_beats(duration_ms)
    return max(target, math.ceil(target * 1.15))


def validate_visual_beat_density(
    result: ChapterAnalysisResult,
    *,
    duration_ms: int,
) -> None:
    minimum = minimum_visual_beats(duration_ms)
    actual = sum(len(scene.visual_beats) for scene in result.scenes)
    if actual < minimum:
        raise ValueError(
            f"Storyboard is under-dense: expected at least {minimum} visual beats for "
            f"{duration_ms}ms narration planning duration, received {actual}"
        )


async def latest_narration_duration_ms(
    connection: Any,
    *,
    chapter_id: object,
    source_hash: str,
) -> int | None:
    """Return authoritative narration duration for the current source snapshot when available."""
    value = await connection.fetchval(
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
