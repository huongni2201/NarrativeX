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
    TARGET_VISUAL_BEAT_MS,
    estimated_narration_duration_ms,
)

SCENE_BOUNDARY_ANCHOR_MAX_CHARS = 200


class SceneStructure(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    source_start_anchor: str = Field(min_length=1, max_length=SCENE_BOUNDARY_ANCHOR_MAX_CHARS)
    source_end_anchor: str = Field(min_length=1, max_length=SCENE_BOUNDARY_ANCHOR_MAX_CHARS)
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

    @model_validator(mode="after")
    def require_source_anchors(self) -> VisualBeatShardResult:
        if any(beat.source_anchor is None for beat in self.visual_beats):
            raise ValueError("every generated visual beat requires source_anchor")
        return self


def plan_visual_beat_shards(
    source_text: str,
    structure: ChapterStructureResult,
    *,
    target_beats: int,
    max_beats: int,
) -> list[VisualBeatShard]:
    """Resolve compact scene boundaries and split exact source coverage into bounded shards."""
    if target_beats < 1:
        raise ValueError("target_beats must be positive")
    if max_beats < target_beats:
        raise ValueError("max_beats must be >= target_beats")

    scene_ranges = _resolve_scene_ranges(source_text, structure)
    shards: list[VisualBeatShard] = []
    for scene_index, (scene_start, scene_end) in enumerate(scene_ranges):
        scene_text = source_text[scene_start:scene_end]
        duration_ms = estimated_narration_duration_ms(scene_text)
        scene_target = max(1, math.ceil(duration_ms / TARGET_VISUAL_BEAT_MS))
        shard_count = max(1, math.ceil(scene_target / target_beats))
        ranges = _split_source_range(source_text, scene_start, scene_end, shard_count)
        for shard_index, (start, end) in enumerate(ranges):
            shard_text = source_text[start:end]
            shard_duration = estimated_narration_duration_ms(shard_text)
            minimum = max(1, math.ceil(shard_duration / HARD_MAX_VISUAL_BEAT_MS))
            target = max(minimum, math.ceil(shard_duration / TARGET_VISUAL_BEAT_MS))
            if target > max_beats:
                raise ValueError(
                    f"planned shard exceeds max beats: target={target}, max={max_beats}"
                )
            maximum = min(max_beats, max(target, math.ceil(target * 1.15)))
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
    """Validate source grounding and merge shard output into the final durable contract."""
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

    return ChapterAnalysisResult(
        characters=structure.characters,
        locations=structure.locations,
        scenes=scenes,
    )


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
        # Start anchors are location hints, not exact coverage boundaries. The first
        # scene owns any chapter prefix and every following scene begins at its own
        # start anchor so the complete source is covered exactly once.
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
        if anchor is None:
            raise ValueError(f"visual beat {beat_index} is missing source_anchor")
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
