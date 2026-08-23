import asyncio
from pathlib import Path
from typing import Any

import ffmpeg  # type: ignore[import-untyped]

from narrativex_worker.rendering.image_motion import (
    ImageMotionManifest,
    MotionBeat,
    validate_manifest,
)


class FfmpegError(RuntimeError):
    pass


def _effective_transition_seconds(manifest: ImageMotionManifest) -> float:
    if len(manifest.beats) < 2 or manifest.transition_seconds <= 0:
        return 0.0
    shortest = min(beat.duration_seconds for beat in manifest.beats)
    return min(manifest.transition_seconds, shortest / 4.0)


def _motion_expressions(beat: MotionBeat, *, frames: int) -> tuple[str, str, str]:
    denominator = max(1, frames - 1)
    progress = f"on/{denominator}"
    centered_x = "iw/2-(iw/zoom/2)"
    centered_y = "ih/2-(ih/zoom/2)"

    if beat.camera_movement in {"PUSH_IN", "ZOOM_IN"}:
        return f"1+0.08*({progress})", centered_x, centered_y
    if beat.camera_movement in {"PULL_OUT", "ZOOM_OUT"}:
        return f"1.08-0.08*({progress})", centered_x, centered_y
    if beat.camera_movement == "PAN":
        return "1.08", f"(iw-iw/zoom)*({progress})", centered_y
    if beat.camera_movement == "TILT":
        return "1.08", centered_x, f"(ih-ih/zoom)*({progress})"
    if beat.camera_movement == "TRACK":
        return "1.06", f"(iw-iw/zoom)*(1-({progress}))", centered_y
    if beat.camera_movement == "PARALLAX":
        # A single still image cannot provide true depth layers. Keep this deterministic
        # pseudo-parallax subtle so it does not look like an aggressive Ken Burns effect.
        return (
            f"1.03+0.05*({progress})",
            f"(iw-iw/zoom)*({progress})",
            f"(ih-ih/zoom)*(1-({progress}))",
        )
    return "1.0", centered_x, centered_y


def _build_clip(
    beat: MotionBeat,
    *,
    width: int,
    height: int,
    fps: int,
) -> Any:
    frames = max(1, round(beat.duration_seconds * fps))
    zoom, x, y = _motion_expressions(beat, frames=frames)

    # Feed the still image once and let zoompan be the only frame generator. This avoids
    # combining a looped input with a second per-input-frame expansion step.
    stream = ffmpeg.input(str(beat.image_path)).video
    return (
        stream.filter("scale", width, height, force_original_aspect_ratio="increase")
        .filter("crop", width, height)
        .filter(
            "zoompan",
            z=zoom,
            x=x,
            y=y,
            d=frames,
            s=f"{width}x{height}",
            fps=fps,
        )
        .filter("setsar", "1")
        .filter("setpts", "PTS-STARTPTS")
    )


def build_ffmpeg_graph(manifest: ImageMotionManifest) -> Any:
    validate_manifest(manifest)
    transition_seconds = _effective_transition_seconds(manifest)

    clips: list[Any] = []
    last_index = len(manifest.beats) - 1
    for index, beat in enumerate(manifest.beats):
        clip = _build_clip(
            beat,
            width=manifest.width,
            height=manifest.height,
            fps=manifest.fps,
        )
        if transition_seconds > 0 and index > 0:
            clip = clip.filter(
                "fade",
                type="in",
                start_time=0,
                duration=f"{transition_seconds:.3f}",
            )
        if transition_seconds > 0 and index < last_index:
            clip = clip.filter(
                "fade",
                type="out",
                start_time=f"{max(0.0, beat.duration_seconds - transition_seconds):.3f}",
                duration=f"{transition_seconds:.3f}",
            )
        clips.append(clip)

    video = clips[0] if len(clips) == 1 else ffmpeg.concat(*clips, v=1, a=0)
    if manifest.subtitle_path is not None:
        video = video.filter("ass", filename=str(manifest.subtitle_path))

    output_options: dict[str, object] = {
        "vcodec": manifest.video_encoder,
        "pix_fmt": "yuv420p",
        "r": manifest.fps,
        "movflags": "+faststart",
        "shortest": None,
    }
    if manifest.video_encoder == "libx264":
        output_options.update({"preset": manifest.x264_preset, "crf": manifest.crf})
    else:
        output_options.update(
            {
                "preset": manifest.nvenc_preset,
                "rc": "vbr",
                "cq": manifest.nvenc_cq,
                "b:v": "0",
            }
        )

    if manifest.audio_path is not None:
        audio = ffmpeg.input(str(manifest.audio_path)).audio
        output_options.update(
            {"acodec": "aac", "b:a": manifest.audio_bitrate, "ar": 48_000}
        )
        return ffmpeg.output(video, audio, str(manifest.output_path), **output_options)

    return ffmpeg.output(video, str(manifest.output_path), **output_options)


def build_ffmpeg_args(manifest: ImageMotionManifest) -> list[str]:
    graph = build_ffmpeg_graph(manifest)
    return [str(value) for value in ffmpeg.compile(graph, overwrite_output=True)]


async def render_image_motion(
    manifest: ImageMotionManifest, *, timeout_seconds: float = 300.0
) -> Path:
    manifest.output_path.parent.mkdir(parents=True, exist_ok=True)
    process = await asyncio.create_subprocess_exec(
        *build_ffmpeg_args(manifest),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
    except TimeoutError as exception:
        process.kill()
        await process.wait()
        raise FfmpegError("ffmpeg render timed out") from exception
    if process.returncode != 0:
        message = stderr.decode("utf-8", errors="replace")[-4000:]
        raise FfmpegError(message or "ffmpeg render failed")
    if not manifest.output_path.exists() or manifest.output_path.stat().st_size == 0:
        raise FfmpegError("ffmpeg did not produce a non-empty output")
    return manifest.output_path
