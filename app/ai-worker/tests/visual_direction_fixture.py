from narrativex_worker.schema import VisualDirection


def visual_direction(**overrides: object) -> VisualDirection:
    value: dict[str, object] = {
        "shot_size": "MEDIUM",
        "camera_angle": "EYE_LEVEL",
        "lens_mm": 50,
        "focus_target": "primary story subject",
        "action_phase": "AFTER",
        "subject_placement": "middle third",
        "foreground": None,
        "background": "source-grounded environment",
        "motivated_light": "source-grounded ambient light",
        "palette": "restrained scene palette",
        "camera_movement": "NONE",
        "movement_direction": None,
        "movement_intensity": "SUBTLE",
        "crop_safe_area": "modest crop room on all sides",
    }
    value.update(overrides)
    return VisualDirection.model_validate(value)


def visual_direction_json(**overrides: object) -> dict[str, object]:
    return visual_direction(**overrides).model_dump(mode="json")
