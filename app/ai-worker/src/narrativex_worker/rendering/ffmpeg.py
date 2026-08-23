from __future__ import annotations

import asyncio
import subprocess
from dataclasses import replace
from functools import lru_cache
from pathlib import Path
from typing import Any

import ffmpeg  # type: ignore[import-untyped]
from PIL import Image

from narrativex_worker.rendering.effects import (
    AUTO_TRANSITIONS,
    AnimatedText,
    RenderEffects,
)
from narrativex_worker.rendering.image_motion import (
    ImageMotionManifest,
    MotionBeat,
    validate_manifest,
)


class FfmpegError(RuntimeError):
    pass


def _effective_transition_seconds(manifest: ImageMotionManifest) -> float:
    configured = (
        manifest.transition_seconds
        if manifest.transition_seconds is not None
        else manifest.effects.transition_seconds
    )
    if len(manifest.beats) < 2 or configured <= 0:
        return 0.0
    shortest = min(beat.duration_seconds for beat in manifest.beats)
    return min(configured, shortest / 4.0)


def _eased_progress(easing: str, *, frames: int) -> str:
    raw = f"(on/{max(1, frames - 1)})"
    if easing == "EASE_IN":
        return f"pow({raw},2)"
    if easing == "EASE_OUT":
        return f"(1-pow(1-{raw},2))"
    if easing == "EASE_IN_OUT":
        return f"(({raw})*({raw})*(3-2*({raw})))"
    return raw


def _motion_expressions(beat: MotionBeat, *, frames: int, easing: str) -> tuple[str, str, str]:
    progress = _eased_progress(easing, frames=frames)
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
        # A single still cannot provide true depth layers. The foreground/background
        # compositor plus diagonal motion produces a restrained pseudo-parallax effect.
        return (
            f"1.03+0.05*({progress})",
            f"(iw-iw/zoom)*({progress})",
            f"(ih-ih/zoom)*(1-({progress}))",
        )
    return "1.0", centered_x, centered_y


def _needs_blurred_background(image_path: Path, *, width: int, height: int, mode: str) -> bool:
    if mode == "BLUR":
        return True
    if mode != "AUTO" or not image_path.exists():
        return False
    try:
        with Image.open(image_path) as image:
            source_ratio = image.width / image.height
    except (OSError, ZeroDivisionError):
        return False
    target_ratio = width / height
    return abs(source_ratio - target_ratio) / target_ratio > 0.035


def _frame_still(beat: MotionBeat, *, width: int, height: int, effects: RenderEffects) -> Any:
    stream = ffmpeg.input(str(beat.image_path)).video
    if not _needs_blurred_background(
        beat.image_path,
        width=width,
        height=height,
        mode=effects.background_mode,
    ):
        return stream.filter("scale", width, height, force_original_aspect_ratio="increase").filter(
            "crop", width, height
        )

    split = stream.filter_multi_output("split", 2)
    background = (
        split[0]
        .filter("scale", width, height, force_original_aspect_ratio="increase")
        .filter("crop", width, height)
        .filter("gblur", sigma=effects.background_blur_sigma)
        .filter("eq", brightness=-0.04, saturation=0.82)
    )
    foreground = split[1].filter("scale", width, height, force_original_aspect_ratio="decrease")
    return ffmpeg.overlay(
        background,
        foreground,
        x="(W-w)/2",
        y="(H-h)/2",
        eof_action="repeat",
    )


def _build_clip(
    beat: MotionBeat,
    *,
    duration_seconds: float,
    width: int,
    height: int,
    fps: int,
    effects: RenderEffects,
) -> Any:
    frames = max(1, round(duration_seconds * fps))
    zoom, x, y = _motion_expressions(
        beat,
        frames=frames,
        easing=effects.motion_easing,
    )
    stream = _frame_still(beat, width=width, height=height, effects=effects)
    return (
        stream.filter(
            "zoompan",
            z=zoom,
            x=x,
            y=y,
            d=frames,
            s=f"{width}x{height}",
            fps=fps,
        )
        .filter("format", "yuv420p")
        .filter("setsar", "1")
        .filter("setpts", "PTS-STARTPTS")
    )


def _build_legacy_video(manifest: ImageMotionManifest, transition_seconds: float) -> Any:
    clips: list[Any] = []
    last_index = len(manifest.beats) - 1
    for index, beat in enumerate(manifest.beats):
        clip = _build_clip(
            beat,
            duration_seconds=beat.duration_seconds,
            width=manifest.width,
            height=manifest.height,
            fps=manifest.fps,
            effects=manifest.effects,
        )
        if transition_seconds > 0 and index > 0:
            clip = clip.filter(
                "fade", type="in", start_time=0, duration=f"{transition_seconds:.3f}"
            )
        if transition_seconds > 0 and index < last_index:
            clip = clip.filter(
                "fade",
                type="out",
                start_time=f"{max(0.0, beat.duration_seconds - transition_seconds):.3f}",
                duration=f"{transition_seconds:.3f}",
            )
        clips.append(clip)
    return clips[0] if len(clips) == 1 else ffmpeg.concat(*clips, v=1, a=0)


def _trim(stream: Any, *, start: float = 0.0, end: float | None = None) -> Any:
    options: dict[str, object] = {}
    if start > 0:
        options["start"] = f"{start:.6f}"
    if end is not None:
        options["end"] = f"{end:.6f}"
    return stream.filter("trim", **options).filter("setpts", "PTS-STARTPTS")


def _transition_name(effects: RenderEffects, junction_index: int) -> str:
    name = effects.transition
    if name == "AUTO":
        return AUTO_TRANSITIONS[junction_index % len(AUTO_TRANSITIONS)]
    return name


def _build_transition(
    outgoing: Any,
    incoming: Any,
    *,
    transition_name: str,
    duration_seconds: float,
) -> Any:
    duration = max(0.001, duration_seconds)
    progress = f"(T/{duration:.6f})"

    if transition_name == "DISSOLVE":
        expression = f"if(lte(mod(X*17+Y*13,100)/100,{progress}),B,A)"
        return ffmpeg.filter([outgoing, incoming], "blend", all_expr=expression, shortest=1)
    if transition_name.startswith("WIPE_"):
        conditions = {
            "WIPE_LEFT": f"lte(X/W,{progress})",
            "WIPE_RIGHT": f"gte(X/W,1-{progress})",
            "WIPE_UP": f"lte(Y/H,{progress})",
            "WIPE_DOWN": f"gte(Y/H,1-{progress})",
        }
        return ffmpeg.filter(
            [outgoing, incoming],
            "blend",
            all_expr=f"if({conditions[transition_name]},B,A)",
            shortest=1,
        )
    if transition_name.startswith("SLIDE_"):
        x = "0"
        y = "0"
        if transition_name == "SLIDE_LEFT":
            x = f"w-w*(t/{duration:.6f})"
        elif transition_name == "SLIDE_RIGHT":
            x = f"-w+w*(t/{duration:.6f})"
        elif transition_name == "SLIDE_UP":
            y = f"h-h*(t/{duration:.6f})"
        else:
            y = f"-h+h*(t/{duration:.6f})"
        return ffmpeg.overlay(
            outgoing,
            incoming,
            x=x,
            y=y,
            eval="frame",
            eof_action="pass",
            shortest=1,
        )
    if transition_name == "ZOOM":
        zoomed = (
            incoming.filter(
                "scale",
                f"iw*(0.86+0.14*min(1,t/{duration:.6f}))",
                f"ih*(0.86+0.14*min(1,t/{duration:.6f}))",
                eval="frame",
            )
            .filter("format", "rgba")
            .filter(
                "fade",
                type="in",
                start_time=0,
                duration=f"{duration:.6f}",
                alpha=1,
            )
        )
        return ffmpeg.overlay(
            outgoing,
            zoomed,
            x="(W-w)/2",
            y="(H-h)/2",
            eof_action="pass",
            shortest=1,
        )

    # FADE is a true cross-fade. It intentionally uses blend instead of xfade:
    # xfade rejects zoompan-derived streams on some FFmpeg builds because their
    # negotiated link frame-rate is reported as 1/0 even when frames are CFR.
    return ffmpeg.filter(
        [outgoing, incoming],
        "blend",
        all_expr=f"A*(1-{progress})+B*{progress}",
        shortest=1,
    )


def _build_catalog_video(manifest: ImageMotionManifest, transition_seconds: float) -> Any:
    if transition_seconds <= 0 or manifest.effects.transition == "CUT":
        clips = [
            _build_clip(
                beat,
                duration_seconds=beat.duration_seconds,
                width=manifest.width,
                height=manifest.height,
                fps=manifest.fps,
                effects=manifest.effects,
            )
            for beat in manifest.beats
        ]
        return clips[0] if len(clips) == 1 else ffmpeg.concat(*clips, v=1, a=0)

    count = len(manifest.beats)
    heads: list[Any | None] = [None] * count
    cores: list[Any] = []
    tails: list[Any | None] = [None] * count

    for index, beat in enumerate(manifest.beats):
        extra = (transition_seconds / 2 if index > 0 else 0.0) + (
            transition_seconds / 2 if index < count - 1 else 0.0
        )
        effective_duration = beat.duration_seconds + extra
        clip = _build_clip(
            beat,
            duration_seconds=effective_duration,
            width=manifest.width,
            height=manifest.height,
            fps=manifest.fps,
            effects=manifest.effects,
        )
        branch_count = 1 + int(index > 0) + int(index < count - 1)
        branches = clip.filter_multi_output("split", branch_count) if branch_count > 1 else None
        branch_index = 0

        if index > 0:
            assert branches is not None
            heads[index] = _trim(branches[branch_index], end=transition_seconds)
            branch_index += 1

        core_start = transition_seconds if index > 0 else 0.0
        core_end = effective_duration - transition_seconds if index < count - 1 else None
        core_source = branches[branch_index] if branches is not None else clip
        cores.append(_trim(core_source, start=core_start, end=core_end))
        branch_index += 1

        if index < count - 1:
            assert branches is not None
            tails[index] = _trim(
                branches[branch_index],
                start=effective_duration - transition_seconds,
                end=effective_duration,
            )

    segments: list[Any] = []
    for index, core in enumerate(cores):
        segments.append(core)
        if index >= count - 1:
            continue
        outgoing = tails[index]
        incoming = heads[index + 1]
        assert outgoing is not None and incoming is not None
        segments.append(
            _build_transition(
                outgoing,
                incoming,
                transition_name=_transition_name(manifest.effects, index),
                duration_seconds=transition_seconds,
            )
        )
    return segments[0] if len(segments) == 1 else ffmpeg.concat(*segments, v=1, a=0)


def _apply_color_grade(video: Any, effects: RenderEffects) -> Any:
    if effects.lut_path is not None:
        return video.filter("lut3d", file=str(effects.lut_path), interp="tetrahedral")
    if effects.color_grade == "CINEMATIC":
        return video.filter("eq", contrast=1.08, saturation=0.94, gamma=0.98).filter(
            "colorbalance", bs=-0.025, rh=0.025, pl=1
        )
    if effects.color_grade == "WARM":
        return video.filter("eq", contrast=1.04, saturation=1.04).filter(
            "colorbalance", rs=0.06, bs=-0.05, rh=0.04, bh=-0.03, pl=1
        )
    if effects.color_grade == "COOL":
        return video.filter("eq", contrast=1.04, saturation=0.96).filter(
            "colorbalance", rs=-0.04, bs=0.06, rh=-0.02, bh=0.04, pl=1
        )
    if effects.color_grade == "HORROR":
        return video.filter("eq", contrast=1.13, saturation=0.70, gamma=0.90).filter(
            "colorbalance", gs=-0.035, bs=0.045, pl=1
        )
    if effects.color_grade == "FANTASY":
        return video.filter("eq", contrast=1.05, saturation=1.16, gamma=1.02).filter(
            "colorbalance", rm=0.035, bm=0.05, rh=0.035, bh=0.05, pl=1
        )
    return video


def _watermark_position(name: str) -> tuple[str, str]:
    return {
        "TOP_LEFT": ("24", "24"),
        "TOP_RIGHT": ("W-w-24", "24"),
        "BOTTOM_LEFT": ("24", "H-h-24"),
        "BOTTOM_RIGHT": ("W-w-24", "H-h-24"),
        "CENTER": ("(W-w)/2", "(H-h)/2"),
    }[name]


def _apply_overlays(video: Any, manifest: ImageMotionManifest) -> Any:
    effects = manifest.effects
    if effects.overlay_style in {"FILM_GRAIN", "FILM_GRAIN_VIGNETTE"}:
        video = video.filter("noise", alls=6, allf="t+u")
    if effects.overlay_style in {"VIGNETTE", "FILM_GRAIN_VIGNETTE"}:
        video = video.filter("vignette", angle="PI/5")

    if effects.overlay_path is not None:
        overlay = (
            ffmpeg.input(str(effects.overlay_path), stream_loop=-1)
            .video.filter(
                "scale",
                manifest.width,
                manifest.height,
                force_original_aspect_ratio="increase",
            )
            .filter("crop", manifest.width, manifest.height)
            .filter("format", "rgba")
            .filter("colorchannelmixer", aa=effects.overlay_opacity)
            .filter("setpts", "PTS-STARTPTS")
        )
        video = ffmpeg.overlay(video, overlay, x=0, y=0, eof_action="repeat", shortest=1)

    if effects.watermark_path is not None:
        watermark_width = max(16, round(manifest.width * effects.watermark_width_ratio))
        watermark = (
            ffmpeg.input(str(effects.watermark_path))
            .video.filter("scale", watermark_width, -1)
            .filter("format", "rgba")
            .filter("colorchannelmixer", aa=effects.watermark_opacity)
        )
        x, y = _watermark_position(effects.watermark_position)
        video = ffmpeg.overlay(video, watermark, x=x, y=y, eof_action="repeat")
    return video


def _escape_drawtext_text(value: str) -> str:
    return value.replace("\\", r"\\").replace(":", r"\:").replace("'", r"\'").replace("%", r"\%")


def _text_y(position: str) -> str:
    return {
        "TOP": "h*0.12",
        "CENTER": "(h-text_h)/2",
        "BOTTOM": "h-text_h-h*0.10",
    }[position]


def _text_options(item: AnimatedText, *, text: str) -> dict[str, object]:
    return {
        "text": _escape_drawtext_text(text),
        "fontsize": item.font_size,
        "fontcolor": item.font_color,
        "y": _text_y(item.position),
        "box": 1 if item.box else 0,
        "boxcolor": "black@0.45",
        "boxborderw": 12,
    }


def _apply_standard_text(video: Any, item: AnimatedText) -> Any:
    start = item.start_seconds
    end = item.end_seconds
    options = _text_options(item, text=item.text)
    options["enable"] = f"between(t,{start:.3f},{end:.3f})"
    if item.style == "SLIDE":
        options["x"] = (
            f"if(lt(t,{start + 0.35:.3f}),"
            f"-text_w+(t-{start:.3f})/.35*((w-text_w)/2+text_w),(w-text_w)/2)"
        )
    else:
        options["x"] = "(w-text_w)/2"
        fade_in = 0.18 if item.style == "POP" else 0.25
        fade_out = 0.20 if item.style == "POP" else 0.25
        options["alpha"] = (
            f"if(lt(t,{start:.3f}),0,"
            f"if(lt(t,{start + fade_in:.3f}),(t-{start:.3f})/{fade_in:.3f},"
            f"if(lt(t,{end - fade_out:.3f}),1,max(0,({end:.3f}-t)/{fade_out:.3f}))))"
        )
    return video.filter("drawtext", **options)


def _apply_typewriter_text(video: Any, item: AnimatedText) -> Any:
    text = item.text[:80]
    total = item.end_seconds - item.start_seconds
    interval = min(0.12, max(0.035, total * 0.5 / max(1, len(text))))
    typing_end = min(item.end_seconds, item.start_seconds + interval * len(text))
    for index in range(1, len(text) + 1):
        start = item.start_seconds + interval * (index - 1)
        end = min(typing_end, item.start_seconds + interval * index)
        if end <= start:
            break
        options = _text_options(item, text=text[:index])
        options.update(
            {
                "x": "(w-text_w)/2",
                "enable": f"between(t,{start:.3f},{end:.3f})",
            }
        )
        video = video.filter("drawtext", **options)
    if typing_end < item.end_seconds:
        options = _text_options(item, text=text)
        options.update(
            {
                "x": "(w-text_w)/2",
                "enable": f"between(t,{typing_end:.3f},{item.end_seconds:.3f})",
            }
        )
        video = video.filter("drawtext", **options)
    return video


def _apply_animated_text(video: Any, effects: RenderEffects) -> Any:
    for item in effects.text_overlays:
        video = (
            _apply_typewriter_text(video, item)
            if item.style == "TYPEWRITER"
            else _apply_standard_text(video, item)
        )
    return video


def _build_audio(manifest: ImageMotionManifest) -> Any | None:
    if manifest.audio_path is None:
        return None
    narration = ffmpeg.input(str(manifest.audio_path)).audio.filter("asetpts", "PTS-STARTPTS")
    effects = manifest.effects
    if effects.bgm_path is None:
        return narration

    narration_split = narration.filter_multi_output("asplit", 2)
    narration_mix = narration_split[0]
    sidechain = narration_split[1]
    total_duration = sum(beat.duration_seconds for beat in manifest.beats)
    background_music = (
        ffmpeg.input(str(effects.bgm_path), stream_loop=-1)
        .audio.filter("atrim", duration=f"{total_duration:.3f}")
        .filter("asetpts", "PTS-STARTPTS")
        .filter("volume", effects.bgm_volume)
    )
    ducked_music = ffmpeg.filter(
        [background_music, sidechain],
        "sidechaincompress",
        threshold=effects.duck_threshold,
        ratio=effects.duck_ratio,
        attack=effects.duck_attack_ms,
        release=effects.duck_release_ms,
    )
    return ffmpeg.filter(
        [narration_mix, ducked_music],
        "amix",
        inputs=2,
        duration="first",
        dropout_transition=2,
        normalize=0,
    )


def build_ffmpeg_graph(manifest: ImageMotionManifest) -> Any:
    validate_manifest(manifest)
    transition_seconds = _effective_transition_seconds(manifest)
    if manifest.effects.transition == "LEGACY_FADE":
        video = _build_legacy_video(manifest, transition_seconds)
    else:
        video = _build_catalog_video(manifest, transition_seconds)

    video = _apply_color_grade(video, manifest.effects)
    video = _apply_overlays(video, manifest)
    video = _apply_animated_text(video, manifest.effects)
    if manifest.subtitle_path is not None:
        video = video.filter("ass", filename=str(manifest.subtitle_path))

    encoder = "libx264" if manifest.video_encoder == "auto" else manifest.video_encoder
    output_options: dict[str, object] = {
        "vcodec": encoder,
        "pix_fmt": "yuv420p",
        "r": manifest.fps,
        "movflags": "+faststart",
        "shortest": None,
    }
    if encoder == "libx264":
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

    audio = _build_audio(manifest)
    if audio is not None:
        output_options.update({"acodec": "aac", "b:a": manifest.audio_bitrate, "ar": 48_000})
        return ffmpeg.output(video, audio, str(manifest.output_path), **output_options)
    return ffmpeg.output(video, str(manifest.output_path), **output_options)


def build_ffmpeg_args(manifest: ImageMotionManifest) -> list[str]:
    graph = build_ffmpeg_graph(manifest)
    return [str(value) for value in ffmpeg.compile(graph, overwrite_output=True)]


@lru_cache(maxsize=1)
def _probe_nvenc_sync() -> bool:
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=64x64:r=1",
        "-frames:v",
        "1",
        "-c:v",
        "h264_nvenc",
        "-f",
        "null",
        "-",
    ]
    try:
        completed = subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=8,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
    return completed.returncode == 0


async def nvenc_available() -> bool:
    """Probe the actual NVIDIA runtime, not only whether FFmpeg lists h264_nvenc."""
    return await asyncio.to_thread(_probe_nvenc_sync)


async def _resolve_runtime_encoder(manifest: ImageMotionManifest) -> str:
    if manifest.video_encoder == "libx264":
        return "libx264"
    available = await nvenc_available()
    if manifest.video_encoder == "auto":
        return "h264_nvenc" if available else "libx264"
    if not available:
        raise FfmpegError("h264_nvenc was requested but the NVIDIA runtime probe failed")
    return "h264_nvenc"


def _validate_runtime_assets(manifest: ImageMotionManifest) -> None:
    paths = [beat.image_path for beat in manifest.beats]
    if manifest.audio_path is not None:
        paths.append(manifest.audio_path)
    if manifest.subtitle_path is not None:
        paths.append(manifest.subtitle_path)
    effects = manifest.effects
    for optional in (
        effects.lut_path,
        effects.overlay_path,
        effects.watermark_path,
        effects.bgm_path,
    ):
        if optional is not None:
            paths.append(optional)
    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        raise FfmpegError("render input file is missing: " + ", ".join(missing))


async def render_image_motion(
    manifest: ImageMotionManifest, *, timeout_seconds: float = 300.0
) -> Path:
    validate_manifest(manifest)
    _validate_runtime_assets(manifest)
    resolved_encoder = await _resolve_runtime_encoder(manifest)
    runtime_manifest = replace(manifest, video_encoder=resolved_encoder)
    runtime_manifest.output_path.parent.mkdir(parents=True, exist_ok=True)
    process = await asyncio.create_subprocess_exec(
        *build_ffmpeg_args(runtime_manifest),
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
    if (
        not runtime_manifest.output_path.exists()
        or runtime_manifest.output_path.stat().st_size == 0
    ):
        raise FfmpegError("ffmpeg did not produce a non-empty output")
    return runtime_manifest.output_path
