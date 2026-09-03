"""Compatibility projection from Visual Direction V3 to the current storyboard DB contract."""

from __future__ import annotations

from narrativex_worker.schema import CameraAngle, ShotSize, VisualDirectionV3


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


def legacy_camera_angle(direction: VisualDirectionV3) -> str:
    """Project V3 onto the legacy combined enum until backend storage is fully cut over."""
    explicit = _ANGLE_PROJECTION.get(direction.camera_angle)
    if explicit is not None:
        return explicit
    return _SHOT_PROJECTION[direction.shot_size]


def legacy_camera_movement(direction: VisualDirectionV3) -> str:
    """Return authored movement directly; never infer movement from title or prompt keywords."""
    return direction.camera_movement.value
