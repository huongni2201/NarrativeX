from narrativex_worker.narration.alignment import (
    build_alignment,
    normalize_alignment_duration,
)
from narrativex_worker.narration.models import NarrationSegment, SynthesizedSegment


def _segment(index: int, frame_count: int) -> SynthesizedSegment:
    text_start = index * 4
    return SynthesizedSegment(
        segment=NarrationSegment(
            index=index,
            text_start=text_start,
            text_end=text_start + 4,
            text=f"seg{index}",
        ),
        pcm_bytes=b"\x00\x00" * frame_count,
        sample_rate_hz=48_000,
        channels=1,
    )


def test_build_alignment_rounds_cumulative_pcm_clock_instead_of_each_segment() -> None:
    # Each segment is 1000.5 ms. Rounding each segment independently produces
    # 1000 + 1000 = 2000 ms, while the real cumulative PCM clock is 2001 ms.
    spans = build_alignment([_segment(0, 48_024), _segment(1, 48_024)])

    assert [(span.audio_start_ms, span.audio_end_ms) for span in spans] == [
        (0, 1000),
        (1000, 2001),
    ]


def test_normalize_alignment_duration_distributes_encoded_audio_drift() -> None:
    spans = build_alignment([_segment(0, 48_000), _segment(1, 48_000)])

    normalized = normalize_alignment_duration(spans, audio_duration_ms=2_024)

    assert [(span.audio_start_ms, span.audio_end_ms) for span in normalized] == [
        (0, 1012),
        (1012, 2024),
    ]
