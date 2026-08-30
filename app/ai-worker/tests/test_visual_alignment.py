import pytest

from narrativex_worker.narration.models import AlignmentSpan
from narrativex_worker.visual_alignment import (
    ResolvedVisualBeatRange,
    map_visual_ranges_to_audio,
    resolve_visual_beat_ranges,
)


def test_resolve_visual_beat_ranges_uses_ordered_exact_utf16_offsets() -> None:
    source = "Mở cửa. 😀 Người đàn ông bước vào. Mở cửa lần nữa."

    ranges = resolve_visual_beat_ranges(
        source,
        ["Mở cửa.", "Người đàn ông bước vào.", "Mở cửa lần nữa."],
    )

    assert ranges == [
        ResolvedVisualBeatRange(0, 8),
        ResolvedVisualBeatRange(12, 36),
        ResolvedVisualBeatRange(37, 53),
    ]


def test_resolve_visual_beat_ranges_uses_next_occurrence_for_repeated_anchor() -> None:
    source = "Lặp lại. Nội dung giữa. Lặp lại."

    ranges = resolve_visual_beat_ranges(source, ["Lặp lại.", "Lặp lại."])

    assert ranges[0].text_start == 0
    assert ranges[1].text_start > ranges[0].text_end


def test_resolve_visual_beat_ranges_rejects_missing_or_out_of_order_anchor() -> None:
    with pytest.raises(ValueError, match="visual beat 1 source anchor"):
        resolve_visual_beat_ranges("Một. Hai.", ["Hai.", "Một."])


def test_map_visual_ranges_to_audio_builds_gap_free_audio_clock() -> None:
    text_ranges = [
        ResolvedVisualBeatRange(0, 10),
        ResolvedVisualBeatRange(10, 20),
        ResolvedVisualBeatRange(20, 30),
    ]
    spans = [
        AlignmentSpan(0, 0, 15, 0, 1500),
        AlignmentSpan(1, 15, 30, 1500, 3300),
    ]

    audio_ranges = map_visual_ranges_to_audio(
        text_ranges,
        spans,
        audio_duration_ms=3300,
    )

    assert [(item.audio_start_ms, item.audio_end_ms) for item in audio_ranges] == [
        (0, 1000),
        (1000, 2100),
        (2100, 3300),
    ]


def test_map_visual_ranges_to_audio_rejects_duplicate_transition_points() -> None:
    text_ranges = [
        ResolvedVisualBeatRange(0, 10),
        ResolvedVisualBeatRange(0, 20),
    ]
    spans = [AlignmentSpan(0, 0, 20, 0, 2000)]

    with pytest.raises(ValueError, match="strictly increasing"):
        map_visual_ranges_to_audio(text_ranges, spans, audio_duration_ms=2000)
