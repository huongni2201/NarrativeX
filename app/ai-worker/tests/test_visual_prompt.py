from narrativex_worker.visual_prompt.director import VISUAL_DIRECTION_INSTRUCTIONS


def test_visual_direction_instructions_target_structured_still_images() -> None:
    assert "still-image" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "continuity" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "visual_direction" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "shot_size" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "camera_angle" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "lens_mm" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "focus_target" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "action_phase" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "camera_movement" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "movement_direction" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "movement_intensity" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "crop_safe_area" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "FFmpeg" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "Seedance" not in VISUAL_DIRECTION_INSTRUCTIONS


def test_visual_direction_instructions_do_not_request_legacy_combined_camera_enum() -> None:
    assert "LOW_ANGLE" not in VISUAL_DIRECTION_INSTRUCTIONS
    assert "OVER_THE_SHOULDER" not in VISUAL_DIRECTION_INSTRUCTIONS
