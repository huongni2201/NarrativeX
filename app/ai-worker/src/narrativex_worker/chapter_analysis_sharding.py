"""Deterministic planning and merge helpers for sharded Vertex chapter analysis."""

from __future__ import annotations

import math
from collections import defaultdict

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from narrativex_worker.schema import (
    ChapterAnalysisResult,
    CharacterAnalysis,
    LocationAnalysis,
    SceneAnalysis,
    SceneCharacterRef,
    VisualBeatAnalysis,
)
from narrativex_worker.visual_density import (
    HARD_MAX_VISUAL_BEAT_MS,
    MAX_VISUAL_BEATS_OVER_TARGET_RATIO,
    TARGET_VISUAL_BEAT_MS,
    estimated_narration_duration_ms,
    maximum_visual_beats,
    minimum_visual_beats,
    target_visual_beats,
)
from narrativex_worker.visual_prompt.sequence_planner import plan_chapter_shots

SCENE_BOUNDARY_ANCHOR_MAX_CHARS = 200
_SEMANTIC_BASE_FACTOR = 8
_SEMANTIC_SIGNAL_CAP = 24


class SceneVisualSignals(BaseModel):
    """Source-grounded scene events used only to redistribute a duration-derived beat budget."""

    model_config = ConfigDict(extra="forbid")

    physical_actions: int = Field(default=0, ge=0, le=100)
    speaker_changes: int = Field(default=0, ge=0, le=100)
    reveals: int = Field(default=0, ge=0, le=100)
    emotional_turns: int = Field(default=0, ge=0, le=100)
    important_objects: int = Field(default=0, ge=0, le=100)
    pov_changes: int = Field(default=0, ge=0, le=100)
    cause_effect_boundaries: int = Field(default=0, ge=0, le=100)

    @property
    def total(self) -> int:
        return sum(
            (
                self.physical_actions,
                self.speaker_changes,
                self.reveals,
                self.emotional_turns,
                self.important_objects,
                self.pov_changes,
                self.cause_effect_boundaries,
            )
        )


class SceneStructure(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    source_start_anchor: str = Field(min_length=1, max_length=SCENE_BOUNDARY_ANCHOR_MAX_CHARS)
    source_end_anchor: str = Field(min_length=1, max_length=SCENE_BOUNDARY_ANCHOR_MAX_CHARS)
    visual_signals: SceneVisualSignals = Field(default_factory=SceneVisualSignals)
    characters: list[SceneCharacterRef] = Field(default_factory=list)
    location_key: str | None = None

    @field_validator("source_start_anchor", mode="before")
    @classmethod
    def normalize_source_start_anchor(cls, value: object) -> object:
        if isinstance(value, str) and len(value) > SCENE_BOUNDARY_ANCHOR_MAX_CHARS:
            return value[:SCENE_BOUNDARY_ANCHOR_MAX_CHARS]
        return value

    @field_validator("source_end_anchor", mode="before")
    @classmethod
    def normalize_source_end_anchor(cls, value: object) -> object:
        if isinstance(value, str) and len(value) > SCENE_BOUNDARY_ANCHOR_MAX_CHARS:
            return value[-SCENE_BOUNDARY_ANCHOR_MAX_CHARS:]
        return value


class ChapterStructureResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    characters: list[CharacterAnalysis] = Field(default_factory=list)
    locations: list[LocationAnalysis] = Field(default_factory=list)
    scenes: list[SceneStructure] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_references(self) -> ChapterStructureResult:
        character_keys = [character.key for character in self.characters]
        location_keys = [location.key for location in self.locations]
        if len(character_keys) != len(set(character_keys)):
            raise ValueError("character keys must be unique")
        if len(location_keys) != len(set(location_keys)):
            raise ValueError("location keys must be unique")

        known_character_keys = set(character_keys)
        known_location_keys = set(location_keys)
        for scene_index, scene in enumerate(self.scenes):
            scene_character_keys = [ref.character_key for ref in scene.characters]
            if len(scene_character_keys) != len(set(scene_character_keys)):
                raise ValueError(f"scene {scene_index} contains duplicate character references")
            for character_key in scene_character_keys:
                if character_key not in known_character_keys:
                    raise ValueError(
                        f"scene {scene_index} references unknown character_key {character_key!r}"
                    )
            if scene.location_key is not None and scene.location_key not in known_location_keys:
                raise ValueError(
                    f"scene {scene_index} references unknown location_key {scene.location_key!r}"
                )
        return self


class VisualBeatShard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scene_index: int = Field(ge=0)
    shard_index: int = Field(ge=0)
    source_start: int = Field(ge=0)
    source_end: int = Field(gt=0)
    source_text: str = Field(min_length=1)
    minimum_beats: int = Field(ge=1)
    target_beats: int = Field(ge=1)
    maximum_beats: int = Field(ge=1)

    @model_validator(mode="after")
    def validate_bounds(self) -> VisualBeatShard:
        if self.source_end <= self.source_start:
            raise ValueError("source_end must be greater than source_start")
        if not self.minimum_beats <= self.target_beats <= self.maximum_beats:
            raise ValueError("beat bounds must satisfy minimum <= target <= maximum")
        return self


class VisualBeatShardResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    visual_beats: list[VisualBeatAnalysis] = Field(min_length=1)


def plan_visual_beat_shards(
    source_text: str,
    structure: ChapterStructureResult,
    *,
    target_beats: int,
    max_beats: int,
    planning_duration_ms: int | None = None,
    target_visual_beat_ms: int = TARGET_VISUAL_BEAT_MS,
    hard_max_visual_beat_ms: int = HARD_MAX_VISUAL_BEAT_MS,
    max_over_target_ratio: float = MAX_VISUAL_BEATS_OVER_TARGET_RATIO,
) -> list[VisualBeatShard]:
    """Allocate one duration budget, then redistribute it using source-grounded semantic density."""
    if target_beats < 1:
        raise ValueError("target_beats must be positive")
    if max_beats < target_beats:
        raise ValueError("max_beats must be >= target_beats")

    duration_ms = planning_duration_ms or estimated_narration_duration_ms(source_text)
    if duration_ms <= 0:
        raise ValueError("planning_duration_ms must be positive")

    scene_ranges = _resolve_scene_ranges(source_text, structure)
    scene_weights = [
        max(1, end - start) * _semantic_factor(scene.visual_signals)
        for (start, end), scene in zip(scene_ranges, structure.scenes, strict=True)
    ]
    global_minimum = minimum_visual_beats(
        duration_ms,
        hard_max_visual_beat_ms=hard_max_visual_beat_ms,
    )
    global_target = target_visual_beats(
        duration_ms,
        target_visual_beat_ms=target_visual_beat_ms,
    )
    global_maximum = maximum_visual_beats(
        duration_ms,
        target_visual_beat_ms=target_visual_beat_ms,
        max_over_target_ratio=max_over_target_ratio,
    )

    scene_target_total = max(global_target, len(scene_ranges))
    scene_targets = _allocate_budget(
        scene_weights,
        scene_target_total,
        lower_bounds=[1] * len(scene_ranges),
    )

    raw_shards: list[tuple[int, int, int, int, str]] = []
    for scene_index, ((scene_start, scene_end), scene_target) in enumerate(
        zip(scene_ranges, scene_targets, strict=True)
    ):
        shard_count = max(1, math.ceil(scene_target / target_beats))
        ranges = _split_source_range(source_text, scene_start, scene_end, shard_count)
        for shard_index, (start, end) in enumerate(ranges):
            raw_shards.append(
                (scene_index, shard_index, start, end, source_text[start:end])
            )

    shard_weights = [
        max(1, end - start) * _semantic_factor(structure.scenes[scene_index].visual_signals)
        for scene_index, _, start, end, _ in raw_shards
    ]
    shard_count = len(raw_shards)
    minimum_total = max(global_minimum, shard_count)
    target_total = max(global_target, minimum_total)
    maximum_total = max(global_maximum, target_total)

    minimum_allocations = _allocate_budget(
        shard_weights,
        minimum_total,
        lower_bounds=[1] * shard_count,
    )
    target_allocations = _allocate_budget(
        shard_weights,
        target_total,
        lower_bounds=minimum_allocations,
    )
    maximum_allocations = _allocate_budget(
        shard_weights,
        maximum_total,
        lower_bounds=target_allocations,
    )

    shards: list[VisualBeatShard] = []
    for raw, minimum, target, maximum in zip(
        raw_shards,
        minimum_allocations,
        target_allocations,
        maximum_allocations,
        strict=True,
    ):
        scene_index, shard_index, start, end, shard_text = raw
        if target > max_beats:
            raise ValueError(
                f"planned shard exceeds max beats: target={target}, max={max_beats}"
            )
        maximum = min(max_beats, max(target, maximum))
        shards.append(
            VisualBeatShard(
                scene_index=scene_index,
                shard_index=shard_index,
                source_start=start,
                source_end=end,
                source_text=shard_text,
                minimum_beats=minimum,
                target_beats=target,
                maximum_beats=maximum,
            )
        )
    return shards


def _semantic_factor(signals: SceneVisualSignals) -> int:
    return _SEMANTIC_BASE_FACTOR + min(signals.total, _SEMANTIC_SIGNAL_CAP)


def _allocate_budget(
    weights: list[int],
    total: int,
    *,
    lower_bounds: list[int],
) -> list[int]:
    """Deterministically distribute an integer budget without per-segment ceil inflation."""
    if not weights or len(weights) != len(lower_bounds):
        raise ValueError("weights and lower_bounds must be non-empty and aligned")
    if any(weight <= 0 for weight in weights):
        raise ValueError("weights must be positive")
    if any(bound < 0 for bound in lower_bounds):
        raise ValueError("lower bounds must be non-negative")
    lower_total = sum(lower_bounds)
    if total < lower_total:
        raise ValueError("budget cannot be lower than required allocations")

    allocations = list(lower_bounds)
    remaining = total - lower_total
    if remaining == 0:
        return allocations

    weight_total = sum(weights)
    quotas = [remaining * weight / weight_total for weight in weights]
    floors = [math.floor(quota) for quota in quotas]
    for index, floor in enumerate(floors):
        allocations[index] += floor

    leftover = remaining - sum(floors)
    order = sorted(
        range(len(weights)),
        key=lambda index: (quotas[index] - floors[index], weights[index], -index),
        reverse=True,
    )
    for index in order[:leftover]:
        allocations[index] += 1
    return allocations


def validate_visual_beat_shard(
    shard: VisualBeatShard,
    result: VisualBeatShardResult,
    *,
    allowed_character_keys: set[str] | None = None,
) -> None:
    """Validate a shard result before it is admitted into the chapter merge."""
    key = (shard.scene_index, shard.shard_index)
    beat_count = len(result.visual_beats)
    if beat_count < shard.minimum_beats:
        raise ValueError(
            f"shard {key} is under-dense: expected at least {shard.minimum_beats}, "
            f"received {beat_count}"
        )
    if beat_count > shard.maximum_beats:
        raise ValueError(
            f"shard {key} is over-dense: expected at most {shard.maximum_beats}, "
            f"received {beat_count}"
        )
    _validate_shard_anchors(shard, result)

    if allowed_character_keys is not None:
        for beat_index, beat in enumerate(result.visual_beats):
            beat_character_keys = [ref.character_key for ref in beat.characters]
            if len(beat_character_keys) != len(set(beat_character_keys)):
                raise ValueError(
                    f"visual beat {beat_index} contains duplicate character references"
                )
            for character_key in beat_character_keys:
                if character_key not in allowed_character_keys:
                    raise ValueError(
                        f"visual beat {beat_index} references character_key {character_key!r} "
                        "that is not present in the scene"
                    )


def merge_shard_results(
    structure: ChapterStructureResult,
    shards: list[VisualBeatShard],
    results: dict[tuple[int, int], VisualBeatShardResult],
) -> ChapterAnalysisResult:
    """Validate source grounding, merge shard output, then coordinate chapter-level shots."""
    by_scene: dict[int, list[VisualBeatAnalysis]] = defaultdict(list)
    source_by_scene: dict[int, list[str]] = defaultdict(list)
    for shard in sorted(shards, key=lambda item: (item.scene_index, item.shard_index)):
        key = (shard.scene_index, shard.shard_index)
        result = results.get(key)
        if result is None:
            raise ValueError(f"missing visual beat result for shard {key}")
        scene = structure.scenes[shard.scene_index]
        allowed_character_keys = {ref.character_key for ref in scene.characters}
        validate_visual_beat_shard(
            shard,
            result,
            allowed_character_keys=allowed_character_keys,
        )
        by_scene[shard.scene_index].extend(result.visual_beats)
        source_by_scene[shard.scene_index].append(shard.source_text)

    scenes: list[SceneAnalysis] = []
    for scene_index, scene in enumerate(structure.scenes):
        beats = by_scene.get(scene_index, [])
        if not beats:
            raise ValueError(f"scene {scene_index} has no visual beats after merge")
        scenes.append(
            SceneAnalysis(
                title=scene.title,
                narration="".join(source_by_scene[scene_index]),
                characters=scene.characters,
                location_key=scene.location_key,
                visual_beats=beats,
            )
        )

    merged = ChapterAnalysisResult(
        characters=structure.characters,
        locations=structure.locations,
        scenes=scenes,
    )
    return plan_chapter_shots(merged)


def _resolve_scene_ranges(
    source_text: str, structure: ChapterStructureResult
) -> list[tuple[int, int]]:
    anchor_starts: list[int] = []
    search_cursor = 0
    for scene_index, scene in enumerate(structure.scenes):
        start = source_text.find(scene.source_start_anchor, search_cursor)
        if start < 0:
            raise ValueError(
                f"scene {scene_index} source_start_anchor was not found in source order"
            )
        anchor_starts.append(start)
        search_cursor = start + len(scene.source_start_anchor)

    ranges: list[tuple[int, int]] = []
    for scene_index, scene in enumerate(structure.scenes):
        range_start = 0 if scene_index == 0 else anchor_starts[scene_index]
        range_end = (
            anchor_starts[scene_index + 1]
            if scene_index + 1 < len(anchor_starts)
            else len(source_text)
        )
        end_anchor_start = source_text.rfind(
            scene.source_end_anchor,
            anchor_starts[scene_index],
            range_end,
        )
        if end_anchor_start < 0:
            raise ValueError(
                f"scene {scene_index} source_end_anchor was not found before the next scene"
            )
        ranges.append((range_start, range_end))
    return ranges


def _validate_shard_anchors(shard: VisualBeatShard, result: VisualBeatShardResult) -> None:
    cursor = 0
    for beat_index, beat in enumerate(result.visual_beats):
        anchor = beat.source_anchor
        offset = shard.source_text.find(anchor, cursor)
        if offset < 0:
            if anchor in shard.source_text:
                raise ValueError(f"visual beat {beat_index} source_anchor is out of source order")
            raise ValueError(f"visual beat {beat_index} source_anchor is outside shard source")
        cursor = offset + len(anchor)


def _split_source_range(
    source_text: str, start: int, end: int, parts: int
) -> list[tuple[int, int]]:
    if parts <= 1:
        return [(start, end)]

    ranges: list[tuple[int, int]] = []
    current = start
    for part in range(parts - 1):
        remaining_parts = parts - part
        ideal = current + max(1, (end - current) // remaining_parts)
        boundary = _nearest_boundary(source_text, ideal, end)
        if boundary <= current:
            boundary = ideal
        ranges.append((current, boundary))
        current = boundary
    ranges.append((current, end))
    return [(left, right) for left, right in ranges if right > left]


def _nearest_boundary(source_text: str, ideal: int, end: int) -> int:
    search_end = min(end, ideal + 500)
    candidates: list[int] = []
    for token in ("\n\n", ". ", "! ", "? ", "\n", " "):
        found = source_text.find(token, ideal, search_end)
        if found >= 0:
            candidates.append(found + len(token))
    return min(candidates, default=ideal)
