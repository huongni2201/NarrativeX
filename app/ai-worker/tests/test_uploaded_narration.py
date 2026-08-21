import pytest

from narrativex_worker.narration.uploaded import (
    LocalAlignmentSpan,
    UploadedNarrationPart,
    build_uploaded_part_timeline,
    translate_to_global_audio,
)


def part(sequence: int, duration_ms: int, checksum: str = "a" * 64) -> UploadedNarrationPart:
    return UploadedNarrationPart(f"asset-{sequence}", sequence, duration_ms, checksum)


def test_audio_part_boundaries_create_one_continuous_clock() -> None:
    timeline = build_uploaded_part_timeline([part(0, 31_000), part(1, 27_000), part(2, 40_000)])

    assert [(item.global_start_ms, item.global_end_ms) for item in timeline] == [
        (0, 31_000),
        (31_000, 58_000),
        (58_000, 98_000),
    ]


def test_sentence_crossing_file_boundary_keeps_global_continuity() -> None:
    timeline = build_uploaded_part_timeline([part(0, 10_000), part(1, 10_000)])
    spans = translate_to_global_audio(
        timeline,
        [
            LocalAlignmentSpan(0, 0, 10, 9_500, 10_000, 1.0),
            LocalAlignmentSpan(1, 10, 20, 0, 500, 1.0),
        ],
    )

    assert [(span.local_audio_start_ms, span.local_audio_end_ms) for span in spans] == [
        (9_500, 10_000),
        (10_000, 10_500),
    ]


def test_part_sequence_must_be_contiguous() -> None:
    with pytest.raises(ValueError, match="contiguous"):
        build_uploaded_part_timeline([part(1, 10_000)])
