"""Regression coverage for project-scoped AI continuity identity."""

from narrativex_worker.identity_repository import (
    _Candidate,
    _identity_similarity,
    _unique_candidate_match,
)


def test_candidate_matching_can_link_renamed_character_across_chapters() -> None:
    match = _unique_candidate_match(
        "Alice Nguyen",
        (),
        [_Candidate(entity_id=201, names=("alice",))],
        excluded_entity_ids=set(),
    )

    assert match is not None
    assert match.entity_id == 201
    assert match.basis == "CANDIDATE"
    assert match.confidence >= 0.84


def test_candidate_matching_prefers_alias_observation_over_display_name() -> None:
    match = _unique_candidate_match(
        "Mother",
        ("Alice Nguyen",),
        [
            _Candidate(entity_id=201, names=("alice", "alice nguyen")),
            _Candidate(entity_id=202, names=("mother superior",)),
        ],
        excluded_entity_ids=set(),
    )

    assert match is not None
    assert match.entity_id == 201
    assert match.confidence == 1.0


def test_second_distinct_key_cannot_reuse_entity_already_assigned_in_response() -> None:
    candidates = [_Candidate(entity_id=201, names=("alex",))]

    first = _unique_candidate_match(
        "Alex",
        (),
        candidates,
        excluded_entity_ids=set(),
    )
    second = _unique_candidate_match(
        "Alex",
        (),
        candidates,
        excluded_entity_ids={201},
    )

    assert first is not None
    assert first.entity_id == 201
    assert second is None


def test_ambiguous_candidate_match_does_not_auto_merge() -> None:
    match = _unique_candidate_match(
        "Alex",
        (),
        [
            _Candidate(entity_id=201, names=("alex",)),
            _Candidate(entity_id=202, names=("alex",)),
        ],
        excluded_entity_ids=set(),
    )

    assert match is None


def test_unrelated_names_do_not_match() -> None:
    assert _identity_similarity("alice", "bob") == 0.0
