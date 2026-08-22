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


def build_ffmpeg_args(manifest: ImageMotionManifest) -> list[str]:
    if not manifest.beats:
        raise ValueError("IMAGE_MOTION requires at least one approved beat")
    if manifest.width <= 0 or manifest.height <= 0 or manifest.fps <= 0:
        raise ValueError("render dimensions and fps must be positive")
    args: list[str] = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for beat in manifest.beats:
        if beat.duration_seconds <= 0:
            raise ValueError("beat duration must be positive")
        if beat.camera_movement not in ALLOWED_MOVEMENTS:
            raise ValueError(f"unsupported camera movement: {beat.camera_movement}")
        args.extend(
            [
                "-loop",
                "1",
                "-framerate",
                str(manifest.fps),
                "-t",
                f"{beat.duration_seconds:.3f}",
                "-i",
                str(beat.image_path),
            ]
        )
    audio_index = len(manifest.beats)
    if manifest.audio_path is not None:
        args.extend(["-i", str(manifest.audio_path)])
    filters: list[str] = []
    for index, beat in enumerate(manifest.beats):
        zoom = (
            "1.04"
            if beat.camera_movement in {"PUSH_IN", "ZOOM_IN"}
            else "0.96"
            if beat.camera_movement in {"PULL_OUT", "ZOOM_OUT"}
            else "1.0"
        )
        frames = max(1, round(beat.duration_seconds * manifest.fps))
        filters.append(
            f"[{index}:v]scale={manifest.width}:{manifest.height}:force_original_aspect_ratio=decrease,pad={manifest.width}:{manifest.height}:(ow-iw)/2:(oh-ih)/2,zoompan=z='{zoom}':d={frames}:s={manifest.width}x{manifest.height}:fps={manifest.fps},setsar=1[v{index}]"
        )
    joined = "".join(f"[v{index}]" for index in range(len(manifest.beats)))
    filters.append(f"{joined}concat=n={len(manifest.beats)}:v=1:a=0[vconcat]")
    video_output_label = "vconcat"
    if manifest.subtitle_path is not None:
        escaped = _escape_filter_path(manifest.subtitle_path)
        filters.append(f"[vconcat]ass=filename='{escaped}'[vout]")
        video_output_label = "vout"
    args.extend(["-filter_complex", ";".join(filters), "-map", f"[{video_output_label}]"])
    if manifest.audio_path is not None:
        args.extend(["-map", f"{audio_index}:a:0", "-c:a", "aac"])
    args.extend(
        [
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-r",
            str(manifest.fps),
            "-movflags",
            "+faststart",
            "-shortest",
            str(manifest.output_path),
        ]
    )
    return args


def _escape_filter_path(path: Path) -> str:
    """Escape a path for use inside a quoted FFmpeg filter option."""
    value = str(path)
    return (
        value.replace("\\", r"\\")
        .replace(":", r"\:")
        .replace("'", r"\'")
        .replace(",", r"\,")
        .replace("[", r"\[")
        .replace("]", r"\]")
    )
