from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    SceneStructure,
    VisualBeatShardResult,
    merge_shard_results,
    plan_visual_beat_shards,
)
from narrativex_worker.schema import CharacterAnalysis, LocationAnalysis, VisualBeatAnalysis


def _structure(source: str) -> ChapterStructureResult:
    first, second = source.split("\n\n", 1)
    return ChapterStructureResult(
        characters=[
            CharacterAnalysis(key="lead", name="Lead", visual_prompt="stable lead")
        ],
        locations=[LocationAnalysis(key="room", name="Room", visual_prompt="stable room")],
        scenes=[
            SceneStructure(
                title="First",
                narration=first,
                source_anchor=first,
                characters=[{"character_key": "lead"}],
                location_key="room",
            ),
            SceneStructure(
                title="Second",
                narration=second,
                source_anchor=second,
                characters=[{"character_key": "lead"}],
                location_key="room",
            ),
        ],
    )


def test_planner_resolves_scene_anchors_in_source_order() -> None:
    source = ("alpha " * 120).strip() + "\n\n" + ("beta " * 120).strip()
    shards = plan_visual_beat_shards(source, _structure(source), target_beats=12, max_beats=20)

    assert shards
    assert all(shard.target_beats <= 20 for shard in shards)
    assert [shard.source_start for shard in shards] == sorted(shard.source_start for shard in shards)
    assert {shard.scene_index for shard in shards} == {0, 1}
    assert all(source[shard.source_start : shard.source_end] == shard.source_text for shard in shards)


def test_long_scene_is_split_before_any_shard_exceeds_max_beats() -> None:
    source = ("word " * 1000).strip() + "\n\nshort scene"
    shards = plan_visual_beat_shards(source, _structure(source), target_beats=12, max_beats=20)

    scene_zero = [shard for shard in shards if shard.scene_index == 0]
    assert len(scene_zero) >= 4
    assert all(1 <= shard.minimum_beats <= shard.target_beats <= 20 for shard in scene_zero)


def test_merge_rejects_visual_beat_anchor_outside_its_shard() -> None:
    source = ("alpha " * 40).strip() + "\n\n" + ("beta " * 40).strip()
    structure = _structure(source)
    shards = plan_visual_beat_shards(source, structure, target_beats=12, max_beats=20)
    first = shards[0]
    results = {
        (first.scene_index, first.shard_index): VisualBeatShardResult(
            visual_beats=[
                VisualBeatAnalysis(
                    title="bad",
                    visual_intent="bad anchor",
                    source_anchor="not present in shard",
                )
            ]
        )
    }

    try:
        merge_shard_results(structure, shards[:1], results)
    except ValueError as exc:
        assert "outside shard source" in str(exc)
    else:
        raise AssertionError("expected invalid source anchor to be rejected")


def test_merge_builds_final_scene_with_source_ordered_beats() -> None:
    source = "alpha one alpha two\n\nbeta one beta two"
    structure = _structure(source)
    shards = plan_visual_beat_shards(source, structure, target_beats=12, max_beats=20)
    results: dict[tuple[int, int], VisualBeatShardResult] = {}
    for shard in shards:
        anchor = shard.source_text.split()[0]
        results[(shard.scene_index, shard.shard_index)] = VisualBeatShardResult(
            visual_beats=[
                VisualBeatAnalysis(
                    title=f"beat-{shard.scene_index}-{shard.shard_index}",
                    visual_intent="source grounded",
                    source_anchor=anchor,
                )
            ]
        )

    merged = merge_shard_results(structure, shards, results)

    assert len(merged.scenes) == 2
    assert sum(len(scene.visual_beats) for scene in merged.scenes) == len(shards)
    assert merged.characters[0].key == "lead"
    assert merged.locations[0].key == "room"
