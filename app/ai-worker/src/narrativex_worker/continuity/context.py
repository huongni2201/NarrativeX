"""Bounded continuity context assembly for parallel visual-beat shards."""

from __future__ import annotations

from narrativex_worker.chapter_analysis_sharding import ChapterStructureResult, VisualBeatShard
from narrativex_worker.continuity.planner import fold_scene_states
from narrativex_worker.continuity.schema import (
    ChapterContinuityPlan,
    ContinuityFact,
    ShardContinuityContext,
)

_NEIGHBOR_BUDGET_CHARS = 4000


def _scope_facts(
    facts: list[ContinuityFact],
    *,
    known_character_keys: set[str],
    allowed_character_keys: set[str],
) -> list[ContinuityFact]:
    return [
        fact
        for fact in facts
        if fact.subject_key not in known_character_keys or fact.subject_key in allowed_character_keys
    ]


def build_shard_continuity_contexts(
    *,
    source_text: str,
    structure: ChapterStructureResult,
    plan: ChapterContinuityPlan,
    shards: list[VisualBeatShard],
) -> dict[tuple[int, int], ShardContinuityContext]:
    if len(plan.scene_states) != len(structure.scenes):
        raise ValueError("continuity scene state count must match chapter scene count")

    resolved_states = fold_scene_states(plan, source_text)
    known_character_keys = {character.key for character in structure.characters}
    ordered = sorted(shards, key=lambda item: (item.scene_index, item.shard_index))
    result: dict[tuple[int, int], ShardContinuityContext] = {}

    for index, shard in enumerate(ordered):
        scene = structure.scenes[shard.scene_index]
        state = resolved_states[shard.scene_index]
        allowed = {ref.character_key for ref in scene.characters}
        before = ordered[index - 1].source_text if index > 0 else ""
        after = ordered[index + 1].source_text if index + 1 < len(ordered) else ""
        neighbor = (
            before[-(_NEIGHBOR_BUDGET_CHARS // 2) :]
            + after[: _NEIGHBOR_BUDGET_CHARS // 2]
        )
        result[(shard.scene_index, shard.shard_index)] = ShardContinuityContext(
            sceneKey=state.scene_key,
            timelineKey=state.timeline_key,
            entryFacts=_scope_facts(
                state.entry_facts,
                known_character_keys=known_character_keys,
                allowed_character_keys=allowed,
            ),
            expectedExitFacts=_scope_facts(
                state.exit_facts,
                known_character_keys=known_character_keys,
                allowed_character_keys=allowed,
            ),
            neighborSource=neighbor,
            allowedCharacterKeys=sorted(allowed),
        )
    return result
