"""Deterministic narration-clock normalization for semantic visual beats.

Provider output supplies semantic order/importance only. This module owns timing and
never calls an AI provider, which makes long-form visual density testable and stable.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from math import ceil

from narrativex_worker.schema import VisualGenerationMode


@dataclass(frozen=True, slots=True)
class VisualTimingPolicy:
    target_ms: int = 12_000
    min_ms: int = 4_000
    max_ms: int = 25_000

    def __post_init__(self) -> None:
        if self.min_ms <= 0 or self.target_ms <= 0 or self.max_ms <= 0:
            raise ValueError("visual timing policy values must be positive")
        if not self.min_ms <= self.target_ms <= self.max_ms:
            raise ValueError("expected min_ms <= target_ms <= max_ms")


IMAGE_TIMING_POLICY = VisualTimingPolicy(target_ms=12_000, min_ms=4_000, max_ms=25_000)
VIDEO_TIMING_POLICY = VisualTimingPolicy(target_ms=6_500, min_ms=3_500, max_ms=8_000)


def timing_policy_for(mode: VisualGenerationMode) -> VisualTimingPolicy:
    return VIDEO_TIMING_POLICY if mode is VisualGenerationMode.VIDEO else IMAGE_TIMING_POLICY


@dataclass(frozen=True, slots=True)
class SemanticBeat:
    key: str
    importance: float = 1.0
    reuse_group: str | None = None

    def __post_init__(self) -> None:
        if not self.key:
            raise ValueError("semantic beat key must not be blank")
        if self.importance <= 0:
            raise ValueError("semantic beat importance must be positive")


@dataclass(frozen=True, slots=True)
class TimedVisualBeat:
    key: str
    start_ms: int
    end_ms: int
    reuse_group: str | None = None

    @property
    def duration_ms(self) -> int:
        return self.end_ms - self.start_ms


def normalize_visual_timing(
    narration_duration_ms: int,
    semantic_beats: Sequence[SemanticBeat] | Iterable[SemanticBeat],
    policy: VisualTimingPolicy | None = None,
) -> list[TimedVisualBeat]:
    """Return gap-free ordered beats that exactly cover the narration clock.

    Semantic beats are expanded deterministically when narration is longer than the
    provider seed density. Repeated slices keep ``reuse_group`` so downstream asset
    resolution may reuse/reframe one image instead of generating a new one per slice.
    """
    if narration_duration_ms <= 0:
        raise ValueError("narration_duration_ms must be positive")

    policy = policy or IMAGE_TIMING_POLICY
    seeds = list(semantic_beats)
    if not seeds:
        seeds = [SemanticBeat("auto-0", reuse_group="auto-0")]

    desired_count = max(1, round(narration_duration_ms / policy.target_ms))
    minimum_count = max(1, ceil(narration_duration_ms / policy.max_ms))
    maximum_count = max(1, narration_duration_ms // policy.min_ms)
    target_count = min(maximum_count, max(len(seeds), desired_count, minimum_count))

    expanded = _expand(seeds, target_count)
    durations = _allocate_durations(narration_duration_ms, expanded, policy)

    result: list[TimedVisualBeat] = []
    cursor = 0
    for beat, duration in zip(expanded, durations, strict=True):
        end = cursor + duration
        result.append(TimedVisualBeat(beat.key, cursor, end, beat.reuse_group))
        cursor = end

    if result:
        last = result[-1]
        result[-1] = TimedVisualBeat(
            last.key,
            last.start_ms,
            narration_duration_ms,
            last.reuse_group,
        )
    return result


def _expand(seeds: list[SemanticBeat], target_count: int) -> list[SemanticBeat]:
    if target_count <= len(seeds):
        return seeds[:target_count]

    slices = [1] * len(seeds)
    while sum(slices) < target_count:
        index = max(
            range(len(seeds)),
            key=lambda i: (seeds[i].importance / slices[i], -i),
        )
        slices[index] += 1

    expanded: list[SemanticBeat] = []
    for seed, count in zip(seeds, slices, strict=True):
        reuse_group = seed.reuse_group or seed.key
        for part in range(count):
            key = seed.key if count == 1 else f"{seed.key}#part-{part + 1}"
            expanded.append(SemanticBeat(key, seed.importance / count, reuse_group))
    return expanded


def _allocate_durations(
    total_ms: int,
    beats: list[SemanticBeat],
    policy: VisualTimingPolicy,
) -> list[int]:
    count = len(beats)
    if count == 1:
        return [total_ms]

    base = total_ms // count
    remainder = total_ms % count
    durations = [base + (1 if index < remainder else 0) for index in range(count)]

    if total_ms >= policy.min_ms and count <= total_ms // policy.min_ms:
        assert all(duration >= policy.min_ms for duration in durations)
    assert max(durations) <= policy.max_ms or count == 1
    assert sum(durations) == total_ms
    return durations
