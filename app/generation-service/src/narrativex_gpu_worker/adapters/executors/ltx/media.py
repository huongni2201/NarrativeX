"""Observe and decode native AV bytes before they become a produced artifact."""

import asyncio
import json
import tempfile
from fractions import Fraction
from pathlib import Path

from narrativex_gpu_worker.contracts.artifact import VideoTechnicalMetadata


async def _run(*command: str) -> bytes:
    process = await asyncio.create_subprocess_exec(
        *command,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        async with asyncio.timeout(120):
            output, _ = await process.communicate()
        if process.returncode != 0:
            raise ValueError("Native AV media inspection or decode failed")
        return output
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()


async def inspect_native_video(
    content: bytes, *, ffmpeg: str = "ffmpeg", ffprobe: str = "ffprobe"
) -> VideoTechnicalMetadata:
    with tempfile.TemporaryDirectory(prefix="narrativex-native-av-") as directory:
        path = Path(directory) / "output.mp4"
        await asyncio.to_thread(path.write_bytes, content)
        payload = await _run(
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,width,height,avg_frame_rate,duration:format=duration",
            "-of",
            "json",
            str(path),
        )
        try:
            probe = json.loads(payload)
            streams = probe["streams"]
            video = next(stream for stream in streams if stream["codec_type"] == "video")
            audio = any(stream["codec_type"] == "audio" for stream in streams)
            duration = video.get("duration", probe.get("format", {}).get("duration"))
            metadata = VideoTechnicalMetadata(
                duration_ms=round(float(duration) * 1000),
                width=video["width"],
                height=video["height"],
                fps=float(Fraction(video["avg_frame_rate"])),
                has_audio=audio,
                decode_passed=False,
            )
        except (
            ValueError,
            TypeError,
            KeyError,
            StopIteration,
            ZeroDivisionError,
            OverflowError,
        ) as exc:
            raise ValueError("Native AV stream metadata is invalid") from exc
        if not audio:
            raise ValueError("Native AV output has no audio stream")
        if metadata.width != 1280 or metadata.height != 720 or abs(metadata.fps - 24) > 0.01:
            raise ValueError("Native AV output differs from the pinned 720p/24 FPS profile")
        await _run(
            ffmpeg,
            "-v",
            "error",
            "-xerror",
            "-err_detect",
            "explode",
            "-i",
            str(path),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0",
            "-f",
            "null",
            "-",
        )
        return metadata.model_copy(update={"decode_passed": True})
