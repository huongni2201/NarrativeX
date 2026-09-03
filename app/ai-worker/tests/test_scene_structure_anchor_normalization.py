from narrativex_worker.chapter_analysis_sharding import SceneStructure


ANCHOR_TARGET_CHARS = 200


def test_scene_structure_normalizes_overlong_boundary_anchors() -> None:
    start_anchor = "START-" + ("a" * 1_200) + "-TAIL"
    end_anchor = "HEAD-" + ("b" * 1_200) + "-END"

    scene = SceneStructure.model_validate(
        {
            "title": "Scene",
            "source_start_anchor": start_anchor,
            "source_end_anchor": end_anchor,
        }
    )

    assert scene.source_start_anchor == start_anchor[:ANCHOR_TARGET_CHARS]
    assert scene.source_end_anchor == end_anchor[-ANCHOR_TARGET_CHARS:]
