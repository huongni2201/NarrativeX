import hashlib
import json
from pathlib import Path

from narrativex_worker.continuity.schema import ContinuityFact
from narrativex_worker.continuity.validator import validate_candidate_fact


_FIXTURE = Path(__file__).parent / "fixtures" / "continuity" / "chapters.json"


def _cases() -> list[dict[str, object]]:
    return json.loads(_FIXTURE.read_text(encoding="utf-8"))


def test_continuity_acceptance_corpus_has_exactly_twelve_required_scenarios() -> None:
    cases = _cases()

    assert len(cases) == 12
    assert {case["id"] for case in cases} == {
        "same_room_multi_scene",
        "prop_put_take",
        "outfit_change",
        "injury_persists",
        "day_to_night",
        "flashback_timeline",
        "alias_pronoun",
        "shard_mid_action",
        "no_person_scene",
        "more_than_three_visible",
        "vietnamese_emoji",
        "source_edit_while_active",
    }


def test_corpus_source_anchors_are_exact_and_owned_scope_never_uses_neighbor_text() -> None:
    for case in _cases():
        source = str(case["source"])
        owned = str(case["ownedSource"])
        neighbor = str(case["neighborSource"])
        expected = ContinuityFact.model_validate(case["expected"])

        assert owned in source
        if neighbor:
            assert neighbor in source
            assert neighbor not in owned
        assert expected.evidence_anchor is not None
        assert expected.evidence_anchor in source


def test_deliberate_conflicts_are_reported_without_rewriting_source() -> None:
    for case in _cases():
        source = str(case["source"])
        expected = ContinuityFact.model_validate(case["expected"])
        conflict = dict(case["conflict"])
        candidate_payload = expected.model_dump(mode="json")
        candidate_payload["value"] = conflict["value"]
        if "subjectKey" in conflict:
            candidate_payload["subjectKey"] = conflict["subjectKey"]
        candidate = ContinuityFact.model_validate(candidate_payload)

        report = validate_candidate_fact(
            source_text=source,
            expected=expected,
            candidate=candidate,
            timeline_key=str(case["timelineKey"]),
            allowed_character_keys=set(case.get("allowedCast", [])),
            known_character_keys=set(case.get("knownCharacters", case.get("allowedCast", []))),
            expected_source_hash=hashlib.sha256(source.encode("utf-8")).hexdigest(),
            current_source_hash=(
                hashlib.sha256(str(case["mutatedSource"]).encode("utf-8")).hexdigest()
                if "mutatedSource" in case
                else hashlib.sha256(source.encode("utf-8")).hexdigest()
            ),
            event_applied_too_early=case["id"] == "shard_mid_action",
            timeline_state_leak=case["id"] == "flashback_timeline",
        )

        assert report.status.value == "NEEDS_REVIEW"
        assert any(issue.code == conflict["issue"] for issue in report.issues)
