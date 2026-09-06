"""Bounded continuity context assembly for parallel visual-beat shards."""

from __future__ import annotations

from narrativex_worker.chapter_analysis_sharding import ChapterStructureResult, VisualBeatShard
from narrativex_worker.continuity.planner import event_source_positions, fold_scene_states
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


def _fact_map(facts: list[ContinuityFact]) -> dict[tuple[str, str], ContinuityFact]:
    return {(fact.subject_key, fact.predicate.value): fact for fact in facts}


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
    event_positions = event_source_positions(plan, source_text)
    events = {event.key: event for event in plan.events}
    known_character_keys = {character.key for character in structure.characters}
    ordered = sorted(shards, key=lambda item: (item.scene_index, item.shard_index))
    result: dict[tuple[int, int], ShardContinuityContext] = {}

    shards_by_scene: dict[int, list[tuple[int, VisualBeatShard]]] = {}
    for index, shard in enumerate(ordered):
        shards_by_scene.setdefault(shard.scene_index, []).append((index, shard))

    for scene_index, scene_shards in shards_by_scene.items():
        scene = structure.scenes[scene_index]
        declared_state = plan.scene_states[scene_index]
        resolved_state = resolved_states[scene_index]
        if declared_state.timeline_key != resolved_state.timeline_key:
            raise ValueError("resolved continuity timeline does not match declared scene timeline")

        allowed = {ref.character_key for ref in scene.characters}
        current = _fact_map(resolved_state.entry_facts)
        scene_events = [events[key] for key in declared_state.event_keys]
        applied_events: set[str] = set()

        for shard_offset, (ordered_index, shard) in enumerate(scene_shards):
            for event in scene_events:
                if event.key in applied_events:
                    continue
                if event.timeline_key != resolved_state.timeline_key:
                    raise ValueError(
                        f"scene {resolved_state.scene_key!r} cannot consume event from timeline "
                        f"{event.timeline_key!r}"
                    )
                if event_positions[event.key] < shard.source_start:
                    for fact in event.changes:
                        current[(fact.subject_key, fact.predicate.value)] = fact
                    applied_events.add(event.key)

            entry_facts = list(current.values())

            for event in scene_events:
                if event.key in applied_events:
                    continue
                position = event_positions[event.key]
                if shard.source_start <= position < shard.source_end:
                    for fact in event.changes:
                        current[(fact.subject_key, fact.predicate.value)] = fact
                    applied_events.add(event.key)

            is_last_shard = shard_offset == len(scene_shards) - 1
            if is_last_shard:
                for fact in resolved_state.exit_facts:
                    current[(fact.subject_key, fact.predicate.value)] = fact
            expected_exit_facts = list(current.values())

            before = ordered[ordered_index - 1].source_text if ordered_index > 0 else ""
            after = (
                ordered[ordered_index + 1].source_text
                if ordered_index + 1 < len(ordered)
                else ""
            )
            neighbor = (
                before[-(_NEIGHBOR_BUDGET_CHARS // 2) :]
                + after[: _NEIGHBOR_BUDGET_CHARS // 2]
            )
            result[(shard.scene_index, shard.shard_index)] = ShardContinuityContext(
                sceneKey=resolved_state.scene_key,
                timelineKey=resolved_state.timeline_key,
                entryFacts=_scope_facts(
                    entry_facts,
                    known_character_keys=known_character_keys,
                    allowed_character_keys=allowed,
                ),
                expectedExitFacts=_scope_facts(
                    expected_exit_facts,
                    known_character_keys=known_character_keys,
                    allowed_character_keys=allowed,
                ),
                neighborSource=neighbor,
                allowedCharacterKeys=sorted(allowed),
            )
    return result
