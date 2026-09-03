from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    SceneStructure,
    VisualBeatShardResult,
    merge_shard_results,
    plan_visual_beat_shards,
)
from narrativex_worker.schema import CharacterAnalysis, LocationAnalysis, VisualBeatAnalysis


def _scene_source(marker: str, words: int) -> str:
    return f"BEGIN_{marker} " + (f"{marker.lower()} " * words).strip() + f" END_{marker}"


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
                source_start_anchor=first[: min(32, len(first))],
                source_end_anchor=first[-min(32, len(first)) :],
                characters=[{"character_key": "lead"}],
                location_key="room",
            ),
            SceneStructure(
                title="Second",
                source_start_anchor=second[: min(32, len(second))],
                source_end_anchor=second[-min(32, len(second)) :],
                characters=[{"character_key": "lead"}],
                location_key="room",
            ),
        ],
    )


def _direction() -> dict[str, object]:
    return {
        "shot_size": "MEDIUM",
        "camera_angle": "EYE_LEVEL",
        "lens_mm": 50,
        "focus_target": "source-grounded subject",
        "action_phase": "AFTER",
        "subject_placement": "middle third",
        "foreground": None,
        "background": "source-grounded environment",
        "motivated_light": "ambient source light",
        "palette": "neutral",
        "camera_movement": "NONE",
        "movement_direction": None,
        "movement_intensity": "SUBTLE",
        "crop_safe_area": "all sides",
    }


def _beats(anchor: str, count: int) -> list[VisualBeatAnalysis]:
    return [
        VisualBeatAnalysis.model_validate(
            {
                "title": f"beat-{index}",
                "visual_intent": "source grounded",
                "source_anchor": anchor,
                "visual_direction": _direction(),
            }
        )
        for index in range(count)
    ]


def test_planner_resolves_scene_anchors_in_source_order() -> None:
    source = _scene_source("ALPHA", 120) + "\n\n" + _scene_source("BETA", 120)
    shards = plan_visual_beat_shards(source, _structure(source), target_beats=12, max_beats=20)

    assert shards
    assert all(shard.target_beats <= 20 for shard in shards)
    assert [shard.source_start for shard in shards] == sorted(
        shard.source_start for shard in shards
    )
    assert {shard.scene_index for shard in shards} == {0, 1}
    assert all(
        source[shard.source_start : shard.source_end] == shard.source_text for shard in shards
    )
    assert "".join(shard.source_text for shard in shards) == source


def test_planner_uses_scene_anchors_as_hints_without_dropping_source_edges() -> None:
    source = (
        "Chapter title. BEGIN_ALPHA alpha one alpha two END_ALPHA.\n\n"
        "BEGIN_BETA beta one beta two END_BETA. trailing note"
    )
    structure = ChapterStructureResult(
        scenes=[
            SceneStructure(
                title="First",
                source_start_anchor="BEGIN_ALPHA alpha one",
                source_end_anchor="alpha two END_ALPHA",
            ),
            SceneStructure(
                title="Second",
                source_start_anchor="BEGIN_BETA beta one",
                source_end_anchor="beta two END_BETA",
            ),
        ]
    )

    shards = plan_visual_beat_shards(source, structure, target_beats=12, max_beats=20)

    assert "".join(shard.source_text for shard in shards) == source
    assert shards[0].source_start == 0
    assert shards[-1].source_end == len(source)


def test_long_scene_keeps_each_shard_near_configured_target() -> None:
    source = _scene_source("LONG", 1000) + "\n\n" + _scene_source("SHORT", 2)
    shards = plan_visual_beat_shards(source, _structure(source), target_beats=12, max_beats=20)

    scene_zero = [shard for shard in shards if shard.scene_index == 0]
    assert len(scene_zero) == 3
    assert all(
        1 <= shard.minimum_beats <= shard.target_beats <= 20 for shard in scene_zero
    )
    assert max(shard.target_beats for shard in scene_zero) <= 12


def test_audio_duration_controls_global_visual_beat_budget() -> None:
    source = _scene_source("ALPHA", 900) + "\n\n" + _scene_source("BETA", 900)
    shards = plan_visual_beat_shards(
        source,
        _structure(source),
        target_beats=12,
        max_beats=20,
        planning_duration_ms=240_000,
        target_visual_beat_ms=7_500,
        hard_max_visual_beat_ms=10_000,
        max_over_target_ratio=1.15,
    )

    assert sum(shard.target_beats for shard in shards) == 32
    assert sum(shard.maximum_beats for shard in shards) <= 37


def test_merge_rejects_visual_beat_anchor_outside_its_shard() -> None:
    source = _scene_source("ALPHA", 40) + "\n\n" + _scene_source("BETA", 40)
    structure = _structure(source)
    shards = plan_visual_beat_shards(source, structure, target_beats=12, max_beats=20)
    first = shards[0]
    results = {
        (first.scene_index, first.shard_index): VisualBeatShardResult(
            visual_beats=_beats("not present in shard", first.minimum_beats)
        )
    }

    try:
        merge_shard_results(structure, shards[:1], results)
    except ValueError as exc:
        assert "outside shard source" in str(exc)
    else:
        raise AssertionError("expected invalid source anchor to be rejected")


def test_merge_rejects_more_than_shard_maximum_beats() -> None:
    source = _scene_source("ALPHA", 40) + "\n\n" + _scene_source("BETA", 40)
    structure = _structure(source)
    shards = plan_visual_beat_shards(source, structure, target_beats=12, max_beats=20)
    first = shards[0]
    anchor = first.source_text.split()[0]
    results = {
        (first.scene_index, first.shard_index): VisualBeatShardResult(
            visual_beats=_beats(anchor, first.maximum_beats + 1)
        )
    }

    try:
        merge_shard_results(structure, shards[:1], results)
    except ValueError as exc:
        assert "over-dense" in str(exc)
    else:
        raise AssertionError("expected over-dense shard to be rejected")


def test_merge_reconstructs_source_preserving_scene_narration() -> None:
    source = (
        "BEGIN_ALPHA alpha one alpha two END_ALPHA\n\n"
        "BEGIN_BETA beta one beta two END_BETA"
    )
    structure = _structure(source)
    shards = plan_visual_beat_shards(source, structure, target_beats=12, max_beats=20)
    results: dict[tuple[int, int], VisualBeatShardResult] = {}
    for shard in shards:
        anchor = shard.source_text.split()[0]
        results[(shard.scene_index, shard.shard_index)] = VisualBeatShardResult(
            visual_beats=_beats(anchor, shard.minimum_beats)
        )

    merged = merge_shard_results(structure, shards, results)

    assert len(merged.scenes) == 2
    assert "".join(scene.narration for scene in merged.scenes) == source
    assert sum(len(scene.visual_beats) for scene in merged.scenes) == sum(
        shard.minimum_beats for shard in shards
    )
    assert merged.characters[0].key == "lead"
    assert merged.locations[0].key == "room"
