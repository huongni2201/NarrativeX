"""Deterministic continuity checks. Model output never overrides source/canon authority."""

from __future__ import annotations

from narrativex_worker.continuity.schema import (
    ContinuityFact,
    ContinuityIssue,
    ContinuityIssueOrigin,
    ContinuityIssueSeverity,
    ContinuityReport,
    ContinuityReportStatus,
    ContinuityProvenance,
)


def _issue(code: str, message: str, *, evidence: str | None = None) -> ContinuityIssue:
    return ContinuityIssue(
        code=code,
        severity=ContinuityIssueSeverity.BLOCKING,
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

    This small seam is intentionally deterministic so acceptance fixtures can describe continuity
    outcomes without coupling tests to prompt wording or a paid provider.
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
