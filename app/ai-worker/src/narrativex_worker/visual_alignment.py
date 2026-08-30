"""Resolve visual beat source anchors to deterministic UTF-16 ranges."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from narrativex_worker.narration.segmenter import codepoint_to_utf16_offset


@dataclass(frozen=True, slots=True)
class ResolvedVisualBeatRange:
    text_start: int
    text_end: int


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
