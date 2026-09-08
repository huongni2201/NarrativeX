import hashlib

from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    SceneStructure,
    VisualBeatShard,
)
from narrativex_worker.continuity.context import build_shard_continuity_contexts
from narrativex_worker.continuity.planner import fold_scene_states
from narrativex_worker.continuity.schema import ChapterContinuityPlan
from narrativex_worker.schema import CharacterAnalysis, SceneCharacterRef


def _plan(source: str) -> ChapterContinuityPlan:
    return ChapterContinuityPlan.model_validate(
        {
            "schemaVersion": 1,
            "sourceHash": hashlib.sha256(source.encode("utf-8")).hexdigest(),
            "events": [
                {
                    "key": "lights_off",
                    "sourceAnchor": "Đèn tắt.",
                    "timelineKey": "present",
                    "changes": [
                        {
                            "subjectKey": "room",
                            "predicate": "lighting",
                            "value": "dark",
                            "provenance": "SOURCE",
                            "evidenceAnchor": "Đèn tắt.",
                            "canonVersionId": None,
                        }
                    ],
                },
                {
                    "key": "old_coat",
                    "sourceAnchor": "Ngày trước, An mặc áo trắng.",
                    "timelineKey": "past",
                    "changes": [
                        {
                            "subjectKey": "an",
                            "predicate": "appearance",
                            "value": "white_coat",
                            "provenance": "SOURCE",
                            "evidenceAnchor": "Ngày trước, An mặc áo trắng.",
                            "canonVersionId": None,
                        }
                    ],
                },
            ],
            "sceneStates": [
                {
                    "sceneKey": "present_room",
                    "timelineKey": "present",
                    "entryFacts": [],
                    "exitFacts": [],
                    "eventKeys": ["lights_off"],
                },
                {
                    "sceneKey": "past_memory",
                    "timelineKey": "past",
                    "entryFacts": [],
                    "exitFacts": [],
                    "eventKeys": ["old_coat"],
                },
            ],
        }
    )


def test_fold_scene_states_does_not_cross_timeline_boundaries() -> None:
    source = "Đèn tắt. Ngày trước, An mặc áo trắng."
    states = fold_scene_states(_plan(source), source)

    assert {fact.subject_key for fact in states[0].exit_facts} == {"room"}
    assert {fact.subject_key for fact in states[1].entry_facts} == set()
    assert {fact.subject_key for fact in states[1].exit_facts} == {"an"}


def test_shard_context_filters_unrelated_character_facts_and_bounds_neighbor_source() -> None:
    source = "Đèn tắt. Ngày trước, An mặc áo trắng."
    structure = ChapterStructureResult(
        characters=[
            CharacterAnalysis(key="an", name="An"),
            CharacterAnalysis(key="other", name="Other"),
        ],
        scenes=[
            SceneStructure(
                title="Present",
                source_start_anchor="Đèn tắt.",
                source_end_anchor="Đèn tắt.",
                characters=[],
            ),
            SceneStructure(
                title="Past",
                source_start_anchor="Ngày trước",
                source_end_anchor="áo trắng.",
                characters=[SceneCharacterRef(character_key="an")],
            ),
        ],
    )
    shards = [
        VisualBeatShard(
            scene_index=0,
            shard_index=0,
            source_start=0,
            source_end=9,
            source_text="Đèn tắt.",
            minimum_beats=1,
            target_beats=1,
            maximum_beats=1,
        ),
        VisualBeatShard(
            scene_index=1,
            shard_index=0,
            source_start=10,
            source_end=len(source),
            source_text="Ngày trước, An mặc áo trắng.",
            minimum_beats=1,
            target_beats=1,
            maximum_beats=1,
        ),
    ]

    contexts = build_shard_continuity_contexts(
        source_text=source,
        structure=structure,
        plan=_plan(source),
        shards=shards,
    )

    first = contexts[(0, 0)]
    second = contexts[(1, 0)]
    assert first.allowed_character_keys == []
    assert second.allowed_character_keys == ["an"]
    assert "Ngày trước" in first.neighbor_source
    assert "Đèn tắt." in second.neighbor_source
    assert all(
        fact.subject_key != "other"
        for fact in second.entry_facts + second.expected_exit_facts
    )


def test_later_shard_entry_includes_event_applied_in_earlier_shard() -> None:
    source = "An bước vào. Đèn tắt. An ngồi xuống."
    plan = ChapterContinuityPlan.model_validate(
        {
            "schemaVersion": 1,
            "sourceHash": hashlib.sha256(source.encode("utf-8")).hexdigest(),
            "events": [
                {
                    "key": "lights_off",
                    "sourceAnchor": "Đèn tắt.",
                    "timelineKey": "present",
                    "changes": [
                        {
                            "subjectKey": "room",
                            "predicate": "lighting",
                            "value": "dark",
                            "provenance": "SOURCE",
                            "evidenceAnchor": "Đèn tắt.",
                        }
                    ],
                }
            ],
            "sceneStates": [
                {
                    "sceneKey": "room_scene",
                    "timelineKey": "present",
                    "entryFacts": [],
                    "exitFacts": [],
                    "eventKeys": ["lights_off"],
                }
            ],
        }
    )
    structure = ChapterStructureResult(
        characters=[CharacterAnalysis(key="an", name="An")],
        scenes=[
            SceneStructure(
                title="Room",
                source_start_anchor="An bước vào.",
                source_end_anchor="An ngồi xuống.",
                characters=[SceneCharacterRef(character_key="an")],
            )
        ],
    )
    split = source.index("An ngồi xuống.")
    shards = [
        VisualBeatShard(
            scene_index=0,
            shard_index=0,
            source_start=0,
            source_end=split,
            source_text=source[:split],
            minimum_beats=1,
            target_beats=1,
            maximum_beats=1,
        ),
        VisualBeatShard(
            scene_index=0,
            shard_index=1,
            source_start=split,
            source_end=len(source),
            source_text=source[split:],
            minimum_beats=1,
            target_beats=1,
            maximum_beats=1,
        ),
    ]

    contexts = build_shard_continuity_contexts(
        source_text=source,
        structure=structure,
        plan=plan,
        shards=shards,
    )

    first_exit = {
        (fact.subject_key, fact.predicate.value, fact.value)
        for fact in contexts[(0, 0)].expected_exit_facts
    }
    second_entry = {
        (fact.subject_key, fact.predicate.value, fact.value)
        for fact in contexts[(0, 1)].entry_facts
    }
    assert ("room", "lighting", "dark") in first_exit
    assert ("room", "lighting", "dark") in second_entry
