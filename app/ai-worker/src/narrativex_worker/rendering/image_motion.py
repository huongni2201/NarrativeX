from dataclasses import dataclass
from pathlib import Path

ALLOWED_MOVEMENTS = {
    "NONE",
    "PAN",
    "TILT",
    "PUSH_IN",
    "PULL_OUT",
    "TRACK",
    "ZOOM_IN",
    "ZOOM_OUT",
    "PARALLAX",
}


@dataclass(frozen=True)
class MotionBeat:
    image_path: Path
    duration_seconds: float
    camera_movement: str = "NONE"


@dataclass(frozen=True)
class ImageMotionManifest:
    beats: tuple[MotionBeat, ...]
    audio_path: Path | None
    output_path: Path
    width: int
    height: int
    fps: int = 30
    subtitle_path: Path | None = None
    transition_seconds: float = 0.12
    video_encoder: str = "libx264"
    x264_preset: str = "veryfast"
    crf: int = 20
    nvenc_preset: str = "p5"
    nvenc_cq: int = 21
    audio_bitrate: str = "192k"


def validate_manifest(manifest: ImageMotionManifest) -> None:
    if not manifest.beats:
        raise ValueError("IMAGE_MOTION requires at least one approved beat")
    if manifest.width <= 0 or manifest.height <= 0 or manifest.fps <= 0:
        raise ValueError("render dimensions and fps must be positive")
    if manifest.width % 2 or manifest.height % 2:
        raise ValueError("H.264 render dimensions must be even")
    if manifest.transition_seconds < 0 or manifest.transition_seconds > 1.0:
        raise ValueError("transition_seconds must be between 0 and 1 second")
    if manifest.video_encoder not in {"libx264", "h264_nvenc"}:
        raise ValueError(f"unsupported video encoder: {manifest.video_encoder}")
    if not 0 <= manifest.crf <= 51:
        raise ValueError("crf must be between 0 and 51")
    if not 0 <= manifest.nvenc_cq <= 51:
        raise ValueError("nvenc_cq must be between 0 and 51")
    for beat in manifest.beats:
        if beat.duration_seconds <= 0:
            raise ValueError("beat duration must be positive")
        if beat.camera_movement not in ALLOWED_MOVEMENTS:
            raise ValueError(f"unsupported camera movement: {beat.camera_movement}")
