"""Small FFmpeg composition helpers for long-form project rendering."""

from __future__ import annotations

import asyncio
from pathlib import Path


class ProjectFfmpegError(RuntimeError):
    pass


async def concat_video_segments(
    segments: list[Path], output_path: Path, *, timeout_seconds: float = 900.0
) -> Path:
    if not segments:
        raise ValueError("At least one video segment is required")
    if len(segments) == 1:
        await _run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(segments[0]),
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            timeout_seconds=timeout_seconds,
        )
        return output_path

    list_path = output_path.with_suffix(".concat.txt")
    list_path.write_text(
        "".join(f"file '{_escape_concat_path(path)}'\n" for path in segments),
        encoding="utf-8",
    )
    await _run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(output_path),
        ],
        timeout_seconds=timeout_seconds,
    )
    return output_path


async def concat_audio_parts(
    parts: list[Path],
    output_path: Path,
    *,
    bitrate: str = "192k",
    sample_rate: int = 48_000,
    timeout_seconds: float = 900.0,
) -> Path:
    if not parts:
        raise ValueError("At least one audio part is required")
    if sample_rate <= 0:
        raise ValueError("sample_rate must be positive")
    if not bitrate.strip():
        raise ValueError("bitrate must not be blank")

    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    for part in parts:
        command.extend(["-i", str(part)])

    normalized = [f"[a{index}]" for index in range(len(parts))]
    filters = ";".join(
        f"[{index}:a]aresample={sample_rate},asetpts=PTS-STARTPTS[a{index}]"
        for index in range(len(parts))
    )
    filters += ";" + "".join(normalized) + f"concat=n={len(parts)}:v=0:a=1[aout]"
    command.extend(
        [
            "-filter_complex",
            filters,
            "-map",
            "[aout]",
            "-c:a",
            "aac",
            "-b:a",
            bitrate,
            "-ar",
            str(sample_rate),
            str(output_path),
        ]
    )
    await _run(command, timeout_seconds=timeout_seconds)
    return output_path


async def mux_master_audio(
    video_path: Path,
    audio_path: Path,
    output_path: Path,
    *,
    timeout_seconds: float = 900.0,
) -> Path:
    # concat_audio_parts already creates the pinned AAC master track. Stream-copy it here so
    # long-form rendering pays the encode cost once and avoids a second lossy AAC generation.
    await _run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video_path),
            "-i",
            str(audio_path),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "copy",
            "-shortest",
            "-movflags",
            "+faststart",
            str(output_path),
        ],
        timeout_seconds=timeout_seconds,
    )
    return output_path


async def _run(command: list[str], *, timeout_seconds: float) -> None:
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
    except TimeoutError as exception:
        process.kill()
        await process.wait()
        raise ProjectFfmpegError("ffmpeg long-form operation timed out") from exception
    if process.returncode != 0:
        message = stderr.decode("utf-8", errors="replace")[-4000:]
        raise ProjectFfmpegError(message or "ffmpeg long-form operation failed")


def _escape_concat_path(path: Path) -> str:
    return str(path.resolve()).replace("'", "'\\''")
