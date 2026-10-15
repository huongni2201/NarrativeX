"""Actual CPU media fixtures; these tests do not establish GPU health."""

import asyncio
from pathlib import Path

import pytest

from narrativex_gpu_worker.adapters.executors.ltx.media import inspect_native_video


@pytest.fixture
def media_binaries():
    directory = Path(__file__).resolve().parents[3] / "desktop/resources/ffmpeg"
    ffmpeg, ffprobe = directory / "ffmpeg.exe", directory / "ffprobe.exe"
    if not ffmpeg.exists() or not ffprobe.exists():
        pytest.skip("Desktop native FFmpeg fixtures unavailable")
    return str(ffmpeg), str(ffprobe)


@pytest.mark.parametrize("with_audio", [True, False])
async def test_inspection_uses_observed_duration_and_decodes_real_media(
    tmp_path, media_binaries, with_audio
):
    ffmpeg, ffprobe = media_binaries
    path = tmp_path / "native.mp4"
    command = [
        ffmpeg,
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=size=1280x720:rate=24",
    ]
    if with_audio:
        command += ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"]
    command += ["-t", "0.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(path)]
    proc = await asyncio.create_subprocess_exec(*command)
    assert await proc.wait() == 0
    if with_audio:
        metadata = await inspect_native_video(path.read_bytes(), ffmpeg=ffmpeg, ffprobe=ffprobe)
        assert metadata.duration_ms == 500
        assert metadata.width == 1280 and metadata.height == 720
        assert metadata.fps == 24
        assert metadata.has_audio and metadata.decode_passed
    else:
        with pytest.raises(ValueError, match="audio"):
            await inspect_native_video(path.read_bytes(), ffmpeg=ffmpeg, ffprobe=ffprobe)


async def test_valid_header_does_not_prove_media_decodes(media_binaries):
    ffmpeg, ffprobe = media_binaries
    with pytest.raises(ValueError):
        await inspect_native_video(
            b"\x00\x00\x00\x20ftypisom" + b"0" * 64,
            ffmpeg=ffmpeg,
            ffprobe=ffprobe,
        )
