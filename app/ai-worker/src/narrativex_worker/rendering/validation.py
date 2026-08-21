import asyncio
import json
from pathlib import Path


class RenderValidationError(ValueError):
    pass


async def probe_mp4(path: Path, *, ffprobe_binary: str = "ffprobe") -> dict[str, object]:
    process = await asyncio.create_subprocess_exec(
        ffprobe_binary,
        "-v",
        "error",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        raise RenderValidationError(stderr.decode("utf-8", errors="replace")[-2000:])
    try:
        value = json.loads(stdout.decode("utf-8"))
    except json.JSONDecodeError as exception:
        raise RenderValidationError("ffprobe returned invalid JSON") from exception
    if not isinstance(value, dict):
        raise RenderValidationError("ffprobe response must be an object")
    return value


def validate_probe(
    probe: dict[str, object],
    *,
    width: int,
    height: int,
    expected_duration_seconds: float,
    tolerance_seconds: float = 0.15,
) -> None:
    streams = probe.get("streams")
    if not isinstance(streams, list):
        raise RenderValidationError("render has no streams")
    video = next(
        (item for item in streams if isinstance(item, dict) and item.get("codec_type") == "video"),
        None,
    )
    if (
        not isinstance(video, dict)
        or int(video.get("width", 0)) != width
        or int(video.get("height", 0)) != height
    ):
        raise RenderValidationError("render dimensions do not match manifest")
    if not any(isinstance(item, dict) and item.get("codec_type") == "audio" for item in streams):
        raise RenderValidationError("render must contain an audio stream")
    format_info = probe.get("format")
    duration = float(format_info.get("duration", 0)) if isinstance(format_info, dict) else 0.0
    if abs(duration - expected_duration_seconds) > tolerance_seconds:
        raise RenderValidationError("render duration is outside the manifest tolerance")
