"""Deterministic source-text to narration-clock mapping for visual beats."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from fractions import Fraction

from narrativex_worker.narration.models import AlignmentSpan
from narrativex_worker.narration.segmenter import codepoint_to_utf16_offset


@dataclass(frozen=True, slots=True)
class ResolvedVisualBeatRange:
    text_start: int
    text_end: int


@dataclass(frozen=True, slots=True)
class VisualAudioRange:
    audio_start_ms: int
    audio_end_ms: int


def resolve_visual_beat_ranges(
    source_text: str,
    anchors: Sequence[str],
) -> list[ResolvedVisualBeatRange]:
    """Resolve ordered verbatim anchors into UTF-16 source offsets."""
    if not source_text:
        raise ValueError("source_text must not be empty")
    if not anchors:
        return []

    result: list[ResolvedVisualBeatRange] = []
    search_from = 0
    for index, anchor in enumerate(anchors):
        if not anchor or anchor.isspace():
            raise ValueError(f"visual beat {index} source anchor must not be blank")
        start = source_text.find(anchor, search_from)
        if start < 0:
            raise ValueError(
                f"visual beat {index} source anchor was not found in source order"
            )
        end = start + len(anchor)
        result.append(
            ResolvedVisualBeatRange(
                text_start=codepoint_to_utf16_offset(source_text, start),
                text_end=codepoint_to_utf16_offset(source_text, end),
            )
        )
        search_from = end
    return result


def _map_text_offset_to_audio(offset: int, spans: Sequence[AlignmentSpan]) -> int:
    for span in spans:
        if span.text_start <= offset <= span.text_end:
            text_width = span.text_end - span.text_start
            if text_width <= 0:
                return span.audio_start_ms
            audio_width = span.audio_end_ms - span.audio_start_ms
            relative = offset - span.text_start
            mapped = Fraction(relative * audio_width, text_width) + span.audio_start_ms
            return round(mapped)
    raise ValueError(f"text offset {offset} is outside narration alignment")


def map_visual_ranges_to_audio(
    text_ranges: Sequence[ResolvedVisualBeatRange],
    alignment_spans: Sequence[AlignmentSpan],
    *,
    audio_duration_ms: int,
) -> list[VisualAudioRange]:
    """Build a gap-free visual clock from semantic beat starts."""
    if not text_ranges:
        return []
    if not alignment_spans:
        raise ValueError("narration alignment must not be empty")
    if audio_duration_ms <= 0:
        raise ValueError("audio_duration_ms must be positive")

    starts = [0]
    for text_range in text_ranges[1:]:
        mapped = _map_text_offset_to_audio(text_range.text_start, alignment_spans)
        starts.append(mapped)

    for index in range(1, len(starts)):
        if starts[index] <= starts[index - 1]:
            raise ValueError("visual audio transition points must be strictly increasing")
        if starts[index] >= audio_duration_ms:
            raise ValueError("visual audio transition exceeds narration duration")

    result: list[VisualAudioRange] = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else audio_duration_ms
        result.append(VisualAudioRange(audio_start_ms=start, audio_end_ms=end))
    return result
