"""Render vertical Shorts only from an already edited final video artifact."""

import asyncio
from dataclasses import dataclass
from pathlib import Path


class ShortClipRenderError(RuntimeError):
    pass


@dataclass(frozen=True)
class ShortClipRequest:
    source_path: Path
    output_path: Path
    start_ms: int
    end_ms: int
    target_width: int = 1080
    target_height: int = 1920

    def __post_init__(self) -> None:
        if self.start_ms < 0 or self.end_ms <= self.start_ms:
            raise ValueError("short clip range must satisfy 0 <= start_ms < end_ms")
        if self.target_width != 1080 or self.target_height != 1920:
            raise ValueError("short clips currently require 1080x1920 output")


async def render_short_clip(
    request: ShortClipRequest,
    *,
    timeout_seconds: float = 300.0,
) -> Path:
    """Trim audio/video from the final MP4 and reframe it to 9:16.

    The same start/end range is applied to the muxed final artifact, so audio remains tied to the
    edited video timeline. This function intentionally has no image-generation or pre-edit input.
    """

    duration_seconds = (request.end_ms - request.start_ms) / 1000.0
    start_seconds = request.start_ms / 1000.0
    request.output_path.parent.mkdir(parents=True, exist_ok=True)

    # Scale to fully cover 9:16, then center-crop. Re-encode rather than stream-copy because crop
    # changes the frame geometry; audio is copied when compatible to avoid unnecessary degradation.
    video_filter = (
        f"scale={request.target_width}:{request.target_height}:"
        "force_original_aspect_ratio=increase,"
        f"crop={request.target_width}:{request.target_height}"
    )
    args = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{start_seconds:.3f}",
        "-i",
        str(request.source_path),
        "-t",
        f"{duration_seconds:.3f}",
        "-vf",
        video_filter,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-y",
        str(request.output_path),
    ]
    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
    except TimeoutError as exception:
        process.kill()
        await process.wait()
        raise ShortClipRenderError("ffmpeg short render timed out") from exception
    if process.returncode != 0:
        raise ShortClipRenderError(stderr.decode("utf-8", errors="replace")[-2000:])
    if not request.output_path.exists() or request.output_path.stat().st_size == 0:
        raise ShortClipRenderError("ffmpeg did not produce a non-empty short video")
    return request.output_path
