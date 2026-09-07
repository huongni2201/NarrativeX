"""Deterministic continuity checks. Model output never overrides source/canon authority."""

from __future__ import annotations

from narrativex_worker.chapter_analysis_sharding import ChapterStructureResult, VisualBeatShard
from narrativex_worker.continuity.pipeline_contracts import VisualBeatShardWithContinuityResult
from narrativex_worker.continuity.planner import event_source_positions
from narrativex_worker.continuity.schema import (
    ChapterContinuityPlan,
    ContinuityFact,
    ContinuityIssue,
    ContinuityIssueOrigin,
    ContinuityIssueSeverity,
    ContinuityReport,
    ContinuityReportStatus,
    ContinuityProvenance,
    ShardContinuityContext,
)


def _issue(
    code: str,
    message: str,
    *,
    evidence: str | None = None,
    scope: str | None = None,
) -> ContinuityIssue:
    return ContinuityIssue(
        code=code,
        severity=ContinuityIssueSeverity.BLOCKING,
        scopeKeys=[scope] if scope else [],
        evidenceAnchors=[evidence] if evidence else [],
        message=message,
        origin=ContinuityIssueOrigin.DETERMINISTIC,
    )


def validate_candidate_fact(
    *,
    source_text: str,
    expected: ContinuityFact,
    candidate: ContinuityFact,
    timeline_key: str,
    allowed_character_keys: set[str],
    known_character_keys: set[str],
    expected_source_hash: str,
    current_source_hash: str,
    event_applied_too_early: bool = False,
    timeline_state_leak: bool = False,
) -> ContinuityReport:
    """Validate one visible fact against the pinned source/state expectation.

    This small seam remains useful for the acceptance corpus while production validation composes
    the same deterministic rules across complete shard results below.
    """
    del timeline_key
    issues: list[ContinuityIssue] = []

    if expected_source_hash != current_source_hash:
        issues.append(
            _issue(
                "CONTINUITY_INPUT_STALE",
                "The chapter source changed after continuity analysis was admitted.",
                evidence=expected.evidence_anchor,
            )
        )
    elif candidate.subject_key in known_character_keys and candidate.subject_key not in allowed_character_keys:
        issues.append(
            _issue(
                "CAST_SCOPE_VIOLATION",
                "A candidate continuity fact references a character outside the scoped cast.",
                evidence=candidate.evidence_anchor,
            )
        )
    elif timeline_state_leak:
        issues.append(
            _issue(
                "TIMELINE_STATE_LEAK",
                "State from a different story timeline was applied to this continuity scope.",
                evidence=candidate.evidence_anchor,
            )
        )
    elif event_applied_too_early:
        issues.append(
            _issue(
                "EVENT_APPLIED_TOO_EARLY",
                "A state-changing event was applied before its source evidence occurs.",
                evidence=candidate.evidence_anchor,
            )
        )
    elif (candidate.subject_key, candidate.predicate, candidate.value) != (
        expected.subject_key,
        expected.predicate,
        expected.value,
    ):
        issues.append(
            _issue(
                "UNSUPPORTED_STATE_CHANGE",
                "The candidate visible state conflicts with the source-grounded expected state.",
                evidence=candidate.evidence_anchor or expected.evidence_anchor,
            )
        )

    for fact in (expected, candidate):
        if fact.provenance is ContinuityProvenance.SOURCE:
            anchor = fact.evidence_anchor
            if anchor is None or anchor not in source_text:
                issues.append(
                    _issue(
                        "SOURCE_ANCHOR_MISSING",
                        "A SOURCE continuity fact is not grounded in the pinned chapter source.",
                        evidence=anchor,
                    )
                )

    return ContinuityReport(
        status=(
            ContinuityReportStatus.NEEDS_REVIEW
            if issues
            else ContinuityReportStatus.PASS
        ),
        issues=issues,
    )


def validate_shard_result(
    *,
    source_text: str,
    structure: ChapterStructureResult,
    plan: ChapterContinuityPlan,
    shard: VisualBeatShard,
    context: ShardContinuityContext,
    result: VisualBeatShardWithContinuityResult,
) -> list[ContinuityIssue]:
    """Validate one generated shard against authoritative state at its exact source boundary."""
    known_characters = {character.key for character in structure.characters}
    allowed_characters = set(context.allowed_character_keys)
    event_positions = event_source_positions(plan, source_text)
    events = {event.key: event for event in plan.events}
    expected = {
        (fact.subject_key, fact.predicate.value): fact for fact in context.entry_facts
    }
    timeline_events = sorted(
        (
            event
            for event in plan.events
            if event.timeline_key == context.timeline_key
            and shard.source_start <= event_positions[event.key] < shard.source_end
        ),
        key=lambda event: event_positions[event.key],
    )
    applied: set[str] = set()
    issues: list[ContinuityIssue] = []
    local_cursor = 0

    for beat, state in zip(result.visual_beats, result.continuity_states, strict=True):
        local_position = shard.source_text.find(beat.source_anchor, local_cursor)
        if local_position < 0:
            issues.append(
                _issue(
                    "SOURCE_ANCHOR_MISSING",
                    "A visual beat source anchor is not owned by its shard.",
                    evidence=beat.source_anchor,
                    scope=state.beat_key,
                )
            )
            continue
        local_cursor = local_position + len(beat.source_anchor)
        global_position = shard.source_start + local_position

        for event in timeline_events:
            if event.key in applied or event_positions[event.key] > global_position:
                continue
            for fact in event.changes:
                expected[(fact.subject_key, fact.predicate.value)] = fact
            applied.add(event.key)

        for event_key in state.event_keys:
            referenced_event = events.get(event_key)
            if referenced_event is None:
                issues.append(
                    _issue(
                        "UNKNOWN_CONTINUITY_EVENT",
                        "A beat references an event that is not in the pinned continuity plan.",
                        evidence=beat.source_anchor,
                        scope=state.beat_key,
                    )
                )
                continue
            if referenced_event.timeline_key != context.timeline_key:
                issues.append(
                    _issue(
                        "TIMELINE_STATE_LEAK",
                        "A beat references continuity state from a different timeline.",
                        evidence=beat.source_anchor,
                        scope=state.beat_key,
                    )
                )
            elif event_positions[referenced_event.key] > global_position:
                issues.append(
                    _issue(
                        "EVENT_APPLIED_TOO_EARLY",
                        "A beat applies a state-changing event before its source evidence.",
                        evidence=beat.source_anchor,
                        scope=state.beat_key,
                    )
                )

        for fact in state.entry_facts + state.visible_facts + state.exit_facts:
            issues.extend(
                _validate_fact_grounding(
                    fact,
                    source_text=source_text,
                    known_characters=known_characters,
                    allowed_characters=allowed_characters,
                    scope=state.beat_key,
                )
            )

        for candidate in state.visible_facts:
            expected_fact = expected.get((candidate.subject_key, candidate.predicate.value))
            if expected_fact is None:
                continue
            if candidate.value != expected_fact.value:
                issues.append(
                    _issue(
                        "UNSUPPORTED_STATE_CHANGE",
                        "Visible state conflicts with source-grounded continuity at this beat.",
                        evidence=candidate.evidence_anchor or beat.source_anchor,
                        scope=state.beat_key,
                    )
                )

        for fact in state.exit_facts:
            expected[(fact.subject_key, fact.predicate.value)] = fact

    return _deduplicate_issues(issues)


def _validate_fact_grounding(
    fact: ContinuityFact,
    *,
    source_text: str,
    known_characters: set[str],
    allowed_characters: set[str],
    scope: str,
) -> list[ContinuityIssue]:
    issues: list[ContinuityIssue] = []
    if fact.subject_key in known_characters and fact.subject_key not in allowed_characters:
        issues.append(
            _issue(
                "CAST_SCOPE_VIOLATION",
                "A continuity fact references a character outside the scoped cast.",
                evidence=fact.evidence_anchor,
                scope=scope,
            )
        )
    if fact.provenance is ContinuityProvenance.SOURCE:
        anchor = fact.evidence_anchor
        if anchor is None or anchor not in source_text:
            issues.append(
                _issue(
                    "SOURCE_ANCHOR_MISSING",
                    "A SOURCE continuity fact is not grounded in the pinned chapter source.",
                    evidence=anchor,
                    scope=scope,
                )
            )
    return issues


def _deduplicate_issues(issues: list[ContinuityIssue]) -> list[ContinuityIssue]:
    result: list[ContinuityIssue] = []
    seen: set[tuple[str, tuple[str, ...], tuple[str, ...]]] = set()
    for issue in issues:
        key = (
            issue.code,
            tuple(issue.scope_keys),
            tuple(issue.evidence_anchors),
        )
        if key not in seen:
            seen.add(key)
            result.append(issue)
    return result
