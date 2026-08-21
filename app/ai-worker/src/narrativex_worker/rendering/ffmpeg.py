import asyncio
from pathlib import Path

from narrativex_worker.rendering.image_motion import ImageMotionManifest, build_ffmpeg_args


class FfmpegError(RuntimeError):
    pass


async def render_image_motion(
    manifest: ImageMotionManifest, *, timeout_seconds: float = 300.0
) -> Path:
    manifest.output_path.parent.mkdir(parents=True, exist_ok=True)
    process = await asyncio.create_subprocess_exec(
        *build_ffmpeg_args(manifest), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    try:
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
    except TimeoutError as exception:
        process.kill()
        await process.wait()
        raise FfmpegError("ffmpeg render timed out") from exception
    if process.returncode != 0:
        raise FfmpegError(stderr.decode("utf-8", errors="replace")[-2000:])
    if not manifest.output_path.exists() or manifest.output_path.stat().st_size == 0:
        raise FfmpegError("ffmpeg did not produce a non-empty output")
    return manifest.output_path
