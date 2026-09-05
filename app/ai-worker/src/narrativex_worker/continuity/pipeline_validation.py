"""Deterministic validation helpers for continuity-first analysis output."""

from __future__ import annotations

from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    VisualBeatShard,
    VisualBeatShardResult,
    validate_visual_beat_shard,
)
from narrativex_worker.continuity.pipeline_contracts import (
    ChapterStructureWithContinuityResult,
    VisualBeatShardWithContinuityResult,
)
from narrativex_worker.continuity.schema import (
    ContinuityIssue,
    ContinuityIssueOrigin,
    ContinuityIssueSeverity,
)


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


def validate_shard_continuity_states(
    *,
    source_text: str,
    structure: ChapterStructureWithContinuityResult,
    shard: VisualBeatShard,
    result: VisualBeatShardWithContinuityResult,
) -> list[ContinuityIssue]:
    issues: list[ContinuityIssue] = []
    known_characters = {character.key for character in structure.characters}
    allowed_characters = {
        ref.character_key for ref in structure.scenes[shard.scene_index].characters
    }

    for beat, state in zip(result.visual_beats, result.continuity_states, strict=True):
        if beat.source_anchor not in shard.source_text:
            issues.append(blocking_issue("SOURCE_ANCHOR_MISSING", beat.source_anchor))
        for fact in state.visible_facts:
            if fact.subject_key in known_characters and fact.subject_key not in allowed_characters:
                issues.append(blocking_issue("CAST_SCOPE_VIOLATION", beat.source_anchor))
            if fact.evidence_anchor is not None and fact.evidence_anchor not in source_text:
                issues.append(blocking_issue("SOURCE_ANCHOR_MISSING", fact.evidence_anchor))
    return issues


def blocking_issue(code: str, anchor: str) -> ContinuityIssue:
    return ContinuityIssue(
        code=code,
        severity=ContinuityIssueSeverity.BLOCKING,
        evidenceAnchors=[anchor],
        message=f"Deterministic continuity validation failed: {code}",
        origin=ContinuityIssueOrigin.DETERMINISTIC,
    )
