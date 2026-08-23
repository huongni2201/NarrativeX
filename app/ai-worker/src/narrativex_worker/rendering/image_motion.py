from dataclasses import dataclass, field
from pathlib import Path

from narrativex_worker.rendering.effects import RenderEffects

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
    # Backward-compatible override for the pre-effects manifest contract.
    transition_seconds: float | None = None
    effects: RenderEffects = field(default_factory=RenderEffects.cinematic)
    # auto probes the actual NVENC runtime and falls back to libx264 when unavailable.
    video_encoder: str = "auto"
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
    if manifest.transition_seconds is not None and not 0 <= manifest.transition_seconds <= 2:
        raise ValueError("transition_seconds must be between 0 and 2")
    if manifest.video_encoder not in {"auto", "libx264", "h264_nvenc"}:
        raise ValueError(f"unsupported video encoder: {manifest.video_encoder}")
    if not 0 <= manifest.crf <= 51:
        raise ValueError("crf must be between 0 and 51")
    if not 0 <= manifest.nvenc_cq <= 51:
        raise ValueError("nvenc_cq must be between 0 and 51")
    manifest.effects.validate()
    for beat in manifest.beats:
        if beat.duration_seconds <= 0:
            raise ValueError("beat duration must be positive")
        if beat.camera_movement not in ALLOWED_MOVEMENTS:
            raise ValueError(f"unsupported camera movement: {beat.camera_movement}")
