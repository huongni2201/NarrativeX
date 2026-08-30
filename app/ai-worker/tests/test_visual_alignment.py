import pytest

from narrativex_worker.visual_alignment import (
    ResolvedVisualBeatRange,
    resolve_visual_beat_ranges,
)


def test_resolve_visual_beat_ranges_uses_ordered_exact_utf16_offsets() -> None:
    source = "Mở cửa. 😀 Người đàn ông bước vào. Mở cửa lần nữa."

    ranges = resolve_visual_beat_ranges(
        source,
        ["Mở cửa.", "Người đàn ông bước vào.", "Mở cửa lần nữa."],
    )

    assert ranges == [
        ResolvedVisualBeatRange(0, 7),
        ResolvedVisualBeatRange(11, 34),
        ResolvedVisualBeatRange(35, 50),
    ]


def test_resolve_visual_beat_ranges_uses_next_occurrence_for_repeated_anchor() -> None:
    source = "Lặp lại. Nội dung giữa. Lặp lại."

    ranges = resolve_visual_beat_ranges(source, ["Lặp lại.", "Lặp lại."])

    assert ranges[0].text_start == 0
    assert ranges[1].text_start > ranges[0].text_end


def test_resolve_visual_beat_ranges_rejects_missing_or_out_of_order_anchor() -> None:
    with pytest.raises(ValueError, match="visual beat 1 source anchor"):
        resolve_visual_beat_ranges("Một. Hai.", ["Hai.", "Một."])


def test_resolve_visual_beat_ranges_rejects_blank_anchor() -> None:
    with pytest.raises(ValueError, match="source anchor must not be blank"):
        resolve_visual_beat_ranges("Một. Hai.", ["   "])
