"""Render Shorts only from an already edited final video artifact."""

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

    def __post_init__(self) -> None:
        if self.start_ms < 0 or self.end_ms <= self.start_ms:
            raise ValueError("short clip range must satisfy 0 <= start_ms < end_ms")


async def render_short_clip(
    request: ShortClipRequest,
    *,
    timeout_seconds: float = 300.0,
) -> Path:
    """Trim audio and video from the final edited MP4 while preserving source geometry.

    The same start/end range is applied to the muxed final artifact, so audio stays tied to the
    edited video timeline. No crop, scale, aspect-ratio conversion, image generation, or pre-edit
    input is allowed in this path.
    """

    duration_seconds = (request.end_ms - request.start_ms) / 1000.0
    start_seconds = request.start_ms / 1000.0
    request.output_path.parent.mkdir(parents=True, exist_ok=True)

    # Re-encode for frame-accurate trimming while intentionally applying no video filter. The
    # source width, height and display aspect ratio are therefore preserved by the short output.
    args = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(request.source_path),
        "-ss",
        f"{start_seconds:.3f}",
        "-t",
        f"{duration_seconds:.3f}",
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
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
