"""Structural validation helpers for continuity-first analysis output."""

from __future__ import annotations

from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    VisualBeatShard,
    VisualBeatShardResult,
    validate_visual_beat_shard,
)
from narrativex_worker.continuity.pipeline_contracts import VisualBeatShardWithContinuityResult


def shard_validation_error(
    structure: ChapterStructureResult,
    shard: VisualBeatShard,
    result: VisualBeatShardWithContinuityResult | None,
) -> str | None:
    if result is None:
        return "invalid structured shard output"
    try:
        validate_visual_beat_shard(
            shard,
            VisualBeatShardResult(visual_beats=result.visual_beats),
            allowed_character_keys={
                ref.character_key for ref in structure.scenes[shard.scene_index].characters
            },
        )
    except ValueError as exc:
        return str(exc)
    if len(result.continuity_states) != len(result.visual_beats):
        return "continuity state count does not match visual beat count"
    return None
