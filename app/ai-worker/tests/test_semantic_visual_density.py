from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    SceneStructure,
    plan_visual_beat_shards,
)


def _scene(marker: str, words: int) -> str:
    return f"BEGIN_{marker} " + ((marker.lower() + " ") * words) + f"END_{marker}"


def test_semantically_dense_short_scene_receives_more_than_text_length_baseline() -> None:
    static = _scene("STATIC", 180)
    dynamic = _scene("DYNAMIC", 90)
    source = static + "\n\n" + dynamic
    structure = ChapterStructureResult(
        scenes=[
            SceneStructure(
                title="Static",
                source_start_anchor="BEGIN_STATIC",
                source_end_anchor="END_STATIC",
                visual_signals={},
            ),
            SceneStructure(
                title="Dynamic",
                source_start_anchor="BEGIN_DYNAMIC",
                source_end_anchor="END_DYNAMIC",
                visual_signals={
                    "physical_actions": 3,
                    "speaker_changes": 2,
                    "reveals": 1,
                    "emotional_turns": 2,
                    "cause_effect_boundaries": 2,
                },
            ),
        ]
    )

    shards = plan_visual_beat_shards(
        source,
        structure,
        target_beats=20,
        max_beats=30,
        planning_duration_ms=150_000,
    )
    targets = {
        scene_index: sum(shard.target_beats for shard in shards if shard.scene_index == scene_index)
        for scene_index in (0, 1)
    }

    assert targets[1] > targets[0]


def test_semantic_signals_do_not_change_global_duration_budget() -> None:
    first = _scene("FIRST", 100)
    second = _scene("SECOND", 100)
    source = first + "\n\n" + second
    structure = ChapterStructureResult(
        scenes=[
            SceneStructure(
                title="First",
                source_start_anchor="BEGIN_FIRST",
                source_end_anchor="END_FIRST",
                visual_signals={"physical_actions": 20},
            ),
            SceneStructure(
                title="Second",
                source_start_anchor="BEGIN_SECOND",
                source_end_anchor="END_SECOND",
                visual_signals={},
            ),
        ]
    )

    shards = plan_visual_beat_shards(
        source,
        structure,
        target_beats=20,
        max_beats=30,
        planning_duration_ms=150_000,
    )

    assert sum(shard.target_beats for shard in shards) == 20
