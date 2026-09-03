"""Compatibility projection from structured visual direction to the legacy storyboard DB fields."""

from __future__ import annotations

from narrativex_worker.schema import CameraAngle, ShotSize, VisualDirection


_ANGLE_PROJECTION: dict[CameraAngle, str] = {
    CameraAngle.LOW: "LOW_ANGLE",
    CameraAngle.HIGH: "HIGH_ANGLE",
    CameraAngle.OVER_SHOULDER: "OVER_THE_SHOULDER",
    CameraAngle.POV: "POV",
}

_SHOT_PROJECTION: dict[ShotSize, str] = {
    ShotSize.ESTABLISHING: "WIDE",
    ShotSize.WIDE: "WIDE",
    ShotSize.MEDIUM: "MEDIUM",
    ShotSize.MEDIUM_CLOSE_UP: "CLOSE_UP",
    ShotSize.CLOSE_UP: "CLOSE_UP",
    ShotSize.EXTREME_CLOSE_UP: "EXTREME_CLOSE_UP",
}


def legacy_camera_angle(direction: VisualDirection) -> str:
    """Project structured direction onto the legacy combined enum during storage cut-over."""
    explicit = _ANGLE_PROJECTION.get(direction.camera_angle)
    if explicit is not None:
        return explicit
    return _SHOT_PROJECTION[direction.shot_size]


def legacy_camera_movement(direction: VisualDirection) -> str:
    """Return authored movement directly; never infer movement from title or prompt keywords."""
    return direction.camera_movement.value
