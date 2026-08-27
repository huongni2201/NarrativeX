from narrativex_worker.schema import VisualGenerationMode
from narrativex_worker.visual_timing import (
    SemanticBeat,
    VIDEO_TIMING_POLICY,
    VisualTimingPolicy,
    normalize_visual_timing,
    timing_policy_for,
)


def _assert_clock(duration_ms: int, beats) -> None:
    assert beats[0].start_ms == 0
    assert beats[-1].end_ms == duration_ms
    for left, right in zip(beats, beats[1:], strict=False):
        assert left.end_ms == right.start_ms
        assert left.duration_ms > 0


def test_density_scales_from_30_seconds_to_long_form() -> None:
    seeds = [SemanticBeat("intro"), SemanticBeat("middle", 2), SemanticBeat("end")]
    counts = []
    for duration in (30_000, 120_000, 390_000, 540_000, 3_600_000):
        beats = normalize_visual_timing(duration, seeds)
        _assert_clock(duration, beats)
        counts.append(len(beats))
    assert counts == sorted(counts)
    assert counts[2] > 16
    assert counts[3] > counts[2]
    assert counts[4] > counts[3]


def test_overlong_seed_is_split_and_marks_reuse_group() -> None:
    beats = normalize_visual_timing(90_000, [SemanticBeat("slow-exposition")])
    _assert_clock(90_000, beats)
    assert len(beats) > 1
    assert {beat.reuse_group for beat in beats} == {"slow-exposition"}


def test_tiny_tail_is_distributed_instead_of_emitted_as_pathological_beat() -> None:
    policy = VisualTimingPolicy(target_ms=8_000, min_ms=4_000, max_ms=15_000)
    beats = normalize_visual_timing(25_001, [SemanticBeat("a"), SemanticBeat("b")], policy)
    _assert_clock(25_001, beats)
    assert min(beat.duration_ms for beat in beats) >= policy.min_ms


def test_empty_provider_output_still_covers_audio_deterministically() -> None:
    first = normalize_visual_timing(65_000, [])
    second = normalize_visual_timing(65_000, [])
    assert first == second
    _assert_clock(65_000, first)


def test_video_policy_keeps_generated_shots_at_or_below_eight_seconds() -> None:
    policy = timing_policy_for(VisualGenerationMode.VIDEO)
    assert policy == VIDEO_TIMING_POLICY
    assert policy.target_ms == 6_500
    assert policy.max_ms == 8_000

    beats = normalize_visual_timing(
        65_000,
        [SemanticBeat("reveal"), SemanticBeat("reaction"), SemanticBeat("exit")],
        policy,
    )
    _assert_clock(65_000, beats)
    assert max(beat.duration_ms for beat in beats) <= 8_000


def test_invalid_policy_and_duration_are_rejected() -> None:
    try:
        VisualTimingPolicy(target_ms=3_000, min_ms=4_000, max_ms=10_000)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid policy must fail")

    try:
        normalize_visual_timing(0, [SemanticBeat("x")])
    except ValueError:
        pass
    else:
        raise AssertionError("zero narration duration must fail")
