from narrativex_worker.schema import VisualDirectionV3
from narrativex_worker.visual_prompt.legacy_projection import (
    legacy_camera_angle,
    legacy_camera_movement,
)


def _direction(**overrides: object) -> VisualDirectionV3:
    value: dict[str, object] = {
        "shot_size": "MEDIUM_CLOSE_UP",
        "camera_angle": "LOW",
        "lens_mm": 50,
        "focus_target": "face",
        "action_phase": "REACTION",
        "subject_placement": "left third",
        "foreground": None,
        "background": "room",
        "motivated_light": "window light",
        "palette": "neutral",
        "camera_movement": "PUSH_IN",
        "movement_direction": None,
        "movement_intensity": "SUBTLE",
        "crop_safe_area": "right edge",
    }
    value.update(overrides)
    return VisualDirectionV3.model_validate(value)


def test_legacy_projection_prefers_explicit_low_high_and_pov_angles() -> None:
    assert legacy_camera_angle(_direction(camera_angle="LOW")) == "LOW_ANGLE"
    assert legacy_camera_angle(_direction(camera_angle="HIGH")) == "HIGH_ANGLE"
    assert legacy_camera_angle(_direction(camera_angle="POV")) == "POV"


def test_legacy_projection_uses_shot_size_for_eye_level_framing() -> None:
    assert legacy_camera_angle(_direction(camera_angle="EYE_LEVEL", shot_size="WIDE")) == "WIDE"
    assert (
        legacy_camera_angle(_direction(camera_angle="EYE_LEVEL", shot_size="MEDIUM_CLOSE_UP"))
        == "CLOSE_UP"
    )


def test_legacy_camera_movement_is_authored_not_inferred() -> None:
    assert legacy_camera_movement(_direction(camera_movement="PUSH_IN")) == "PUSH_IN"
    assert legacy_camera_movement(_direction(camera_movement="NONE")) == "NONE"
