"""Deterministic state folding for a source-grounded chapter continuity plan."""

from __future__ import annotations

import hashlib

from narrativex_worker.continuity.schema import (
    ChapterContinuityPlan,
    ContinuityFact,
    SceneContinuityState,
)


def source_hash(source_text: str) -> str:
    """Hash exact UTF-8 source; never normalize text before anchor/timing resolution."""
    return hashlib.sha256(source_text.encode("utf-8")).hexdigest()


def event_source_positions(
    plan: ChapterContinuityPlan,
    source_text: str,
) -> dict[str, int]:
    """Resolve event anchors in declared order so repeated excerpts cannot jump backwards."""
    positions: dict[str, int] = {}
    cursor = 0
    for event in plan.events:
        position = source_text.find(event.source_anchor, cursor)
        if position < 0:
            raise ValueError(
                f"continuity event {event.key!r} anchor missing or out of source order"
            )
        positions[event.key] = position
        cursor = position + len(event.source_anchor)
        for fact in event.changes:
            if fact.evidence_anchor is not None and fact.evidence_anchor not in source_text:
                raise ValueError(
                    f"continuity event {event.key!r} contains missing evidence anchor"
                )
    return positions


def validate_plan_source(plan: ChapterContinuityPlan, source_text: str) -> None:
    if plan.source_hash != source_hash(source_text):
        raise ValueError("CONTINUITY_INPUT_STALE")
    event_source_positions(plan, source_text)


def fold_scene_states(
    plan: ChapterContinuityPlan,
    source_text: str,
) -> list[SceneContinuityState]:
    """Fold event changes into scene entry/exit state without crossing timeline keys."""
    validate_plan_source(plan, source_text)
    events = {event.key: event for event in plan.events}
    state_by_timeline: dict[str, dict[tuple[str, str], ContinuityFact]] = {}
    resolved: list[SceneContinuityState] = []

    for scene in plan.scene_states:
        timeline_state = state_by_timeline.setdefault(scene.timeline_key, {})
        for fact in scene.entry_facts:
            timeline_state[(fact.subject_key, fact.predicate.value)] = fact
        entry = list(timeline_state.values())

        for event_key in scene.event_keys:
            event = events[event_key]
            if event.timeline_key != scene.timeline_key:
                raise ValueError(
                    f"scene {scene.scene_key!r} cannot consume event from timeline "
                    f"{event.timeline_key!r}"
                )
            for fact in event.changes:
                timeline_state[(fact.subject_key, fact.predicate.value)] = fact

        for fact in scene.exit_facts:
            timeline_state[(fact.subject_key, fact.predicate.value)] = fact
        exit_facts = list(timeline_state.values())
        resolved.append(
            scene.model_copy(update={"entry_facts": entry, "exit_facts": exit_facts})
        )
    return resolved
