from narrativex_worker.prompting import (
    CHARACTER_PROFILE_INSTRUCTIONS,
    LOCATION_PROFILE_INSTRUCTIONS,
    SCENE_SEGMENTATION_INSTRUCTIONS,
)


def test_scene_segmentation_prompt_uses_semantic_boundaries() -> None:
    assert "one dominant dramatic purpose" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "same location" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "character goal" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "major revelation" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "narrative mode" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "POV/focus" in SCENE_SEGMENTATION_INSTRUCTIONS


def test_scene_segmentation_prompt_checks_under_and_over_segmentation() -> None:
    assert "under-segmentation" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "over-segmentation" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "and then" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "one or two scenes" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "predetermined number of scenes" in SCENE_SEGMENTATION_INSTRUCTIONS


def test_scene_segmentation_keeps_visual_beats_below_scene_level() -> None:
    assert "those belong to visual beats" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "camera angle" in SCENE_SEGMENTATION_INSTRUCTIONS
    assert "minor gesture" in SCENE_SEGMENTATION_INSTRUCTIONS


def test_character_profile_prompt_separates_permanent_identity_from_current_state() -> None:
    assert "durable source-grounded profile" in CHARACTER_PROFILE_INSTRUCTIONS
    assert "bible" in CHARACTER_PROFILE_INSTRUCTIONS
    assert "visual_prompt" in CHARACTER_PROFILE_INSTRUCTIONS
    assert "age_state" in CHARACTER_PROFILE_INSTRUCTIONS
    assert "wardrobe_context" in CHARACTER_PROFILE_INSTRUCTIONS
    assert "permanent visual identity contract" in CHARACTER_PROFILE_INSTRUCTIONS
    assert "Never put current pose" in CHARACTER_PROFILE_INSTRUCTIONS
    assert "appearance_prompt represents current timeline state" in CHARACTER_PROFILE_INSTRUCTIONS
    assert "establish conservative visual defaults once" in CHARACTER_PROFILE_INSTRUCTIONS
    assert "treated as canonical" in CHARACTER_PROFILE_INSTRUCTIONS
    assert "empty string or empty list" in CHARACTER_PROFILE_INSTRUCTIONS


def test_location_profile_prompt_requires_reusable_visual_canon() -> None:
    assert "reusable visual canon" in LOCATION_PROFILE_INSTRUCTIONS
    assert "architecture" in LOCATION_PROFILE_INSTRUCTIONS
    assert "spatial landmarks" in LOCATION_PROFILE_INSTRUCTIONS
    assert "Never put current character action" in LOCATION_PROFILE_INSTRUCTIONS
