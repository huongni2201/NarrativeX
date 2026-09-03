import pytest
from pydantic import ValidationError

import narrativex_worker.schema as schema


def _direction(**overrides: object) -> dict[str, object]:
    value: dict[str, object] = {
        "shot_size": "MEDIUM_CLOSE_UP",
        "camera_angle": "LOW",
        "lens_mm": 50,
        "focus_target": "heroine hand gripping the broken sword",
        "action_phase": "AFTER",
        "subject_placement": "heroine on left third",
        "foreground": "broken tiles",
        "background": "palace gate",
        "motivated_light": "cold moonlight from upper left",
        "palette": "desaturated blue with restrained warm rim light",
        "camera_movement": "PUSH_IN",
        "movement_direction": None,
        "movement_intensity": "SUBTLE",
        "crop_safe_area": "above and right",
    }
    value.update(overrides)
    return value


def _beat(**overrides: object) -> dict[str, object]:
    value: dict[str, object] = {
        "title": "After impact",
        "visual_intent": "The heroine steadies the broken sword while the opponent recoils.",
        "source_anchor": "Cô siết chặt thanh kiếm gãy",
        "visual_direction": _direction(),
        "characters": [],
    }
    value.update(overrides)
    return value


def test_visual_direction_types_exist() -> None:
    required = {
        "ShotSize",
        "CameraAngle",
        "LensMm",
        "ActionPhase",
        "CameraMovement",
        "MovementDirection",
        "MovementIntensity",
        "VisualDirection",
    }
    missing = sorted(name for name in required if not hasattr(schema, name))
    assert not missing, f"missing visual direction types: {missing}"


def test_visual_beat_requires_source_anchor_and_structured_direction() -> None:
    beat_model = schema.VisualBeatAnalysis

    with pytest.raises(ValidationError):
        beat_model.model_validate(_beat(source_anchor=None))

    with pytest.raises(ValidationError):
        value = _beat()
        value.pop("visual_direction")
        beat_model.model_validate(value)


def test_visual_direction_accepts_independent_shot_size_and_camera_angle() -> None:
    direction = schema.VisualDirection.model_validate(_direction())
    assert direction.shot_size.value == "MEDIUM_CLOSE_UP"
    assert direction.camera_angle.value == "LOW"
    assert direction.lens_mm == 50


def test_visual_direction_rejects_unsupported_lens() -> None:
    with pytest.raises(ValidationError):
        schema.VisualDirection.model_validate(_direction(lens_mm=70))


def test_pan_requires_direction_but_push_in_does_not() -> None:
    with pytest.raises(ValidationError):
        schema.VisualDirection.model_validate(
            _direction(camera_movement="PAN", movement_direction=None)
        )

    direction = schema.VisualDirection.model_validate(
        _direction(camera_movement="PUSH_IN", movement_direction="LEFT")
    )
    assert direction.camera_movement.value == "PUSH_IN"
    assert direction.movement_direction is None


def test_image_generation_settings_has_no_quality_tier_choice() -> None:
    fields = schema.ImageGenerationSettings.model_fields
    assert "quality_tier" not in fields
