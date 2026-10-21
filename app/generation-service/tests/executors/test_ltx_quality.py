"""Actual CPU media fixtures; these tests do not establish GPU health or model quality."""

import asyncio
from pathlib import Path

import pytest

from narrativex_gpu_worker.adapters.executors.ltx.quality import (
    SCORER_VERSION,
    score_video_quality,
)


@pytest.fixture
def ffmpeg():
    directory = Path(__file__).resolve().parents[3] / "desktop/resources/ffmpeg"
    binary = directory / "ffmpeg.exe"
    if not binary.exists():
        pytest.skip("Desktop native FFmpeg fixtures unavailable")
    return str(binary)


async def _clip(
    ffmpeg, path, video, audio="sine=frequency=440:sample_rate=48000", audio_filter=None
):
    """Build a 2 s MP4 from a lavfi video graph and a lavfi audio source."""
    command = [
        ffmpeg, "-v", "error", "-y",
        "-f", "lavfi", "-i", video,
        "-f", "lavfi", "-i", audio,
    ]  # fmt: skip
    if audio_filter:
        command += ["-af", audio_filter]
    command += ["-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(path)]
    process = await asyncio.create_subprocess_exec(*command)
    assert await process.wait() == 0
    return path.read_bytes()


MOVING = "testsrc2=size=1280x720:rate=24"


async def test_good_clip_reports_clean_measurements(tmp_path, ffmpeg):
    data = await _clip(ffmpeg, tmp_path / "good.mp4", MOVING)

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert metrics.status == "MEASURED"
    assert metrics.scorer_version == SCORER_VERSION == "FFMPEG_TAKE_QC_V2"
    assert metrics.freeze_head_ms == 0
    assert metrics.freeze_total_ms == 0
    assert metrics.scene_cut_count == 0
    assert metrics.black_total_ms == 0
    assert metrics.silence_total_ms == 0
    assert metrics.motion_mean > 0
    assert -25 < metrics.integrated_lufs < -18
    assert metrics.peak_dbfs < -10
    assert metrics.mean_y is not None and metrics.mean_u is not None and metrics.mean_v is not None


async def test_frozen_opening_is_measured_as_freeze_head(tmp_path, ffmpeg):
    video = f"color=c=gray:size=1280x720:rate=24:d=1[a];{MOVING}:d=1[b];[a][b]concat=n=2:v=1:a=0"
    data = await _clip(ffmpeg, tmp_path / "freeze.mp4", video)

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert 900 <= metrics.freeze_head_ms <= 1100
    assert 900 <= metrics.freeze_total_ms <= 1100


async def test_trailing_freeze_counts_toward_total_but_not_head(tmp_path, ffmpeg):
    video = f"{MOVING}:d=1[a];color=c=gray:size=1280x720:rate=24:d=1[b];[a][b]concat=n=2:v=1:a=0"
    data = await _clip(ffmpeg, tmp_path / "tail.mp4", video)

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert metrics.freeze_head_ms == 0
    assert 900 <= metrics.freeze_total_ms <= 1100


async def test_hard_cut_inside_clip_is_counted(tmp_path, ffmpeg):
    video = f"{MOVING}:d=1[a];color=c=red:size=1280x720:rate=24:d=1[b];[a][b]concat=n=2:v=1:a=0"
    data = await _clip(ffmpeg, tmp_path / "cut.mp4", video)

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert metrics.scene_cut_count >= 1


async def test_black_clip_reports_black_duration(tmp_path, ffmpeg):
    data = await _clip(ffmpeg, tmp_path / "black.mp4", "color=c=black:size=1280x720:rate=24")

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert 1800 <= metrics.black_total_ms <= 2000


async def test_silent_audio_reports_silence_duration(tmp_path, ffmpeg):
    data = await _clip(ffmpeg, tmp_path / "silent.mp4", MOVING, audio="anullsrc=r=48000:cl=mono")

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert 1800 <= metrics.silence_total_ms <= 2000


async def test_clipped_audio_reaches_full_scale(tmp_path, ffmpeg):
    data = await _clip(ffmpeg, tmp_path / "loud.mp4", MOVING, audio_filter="volume=40dB")

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert metrics.peak_dbfs >= -0.5


async def test_brightness_flicker_raises_flicker_deviation(tmp_path, ffmpeg):
    steady = await _clip(ffmpeg, tmp_path / "steady.mp4", MOVING)
    flicker = await _clip(
        ffmpeg,
        tmp_path / "flicker.mp4",
        f"{MOVING},geq=lum='clip(lum(X,Y)+70*sin(2*PI*T*6),0,255)':cb='cb(X,Y)':cr='cr(X,Y)'",
    )

    steady_metrics = await score_video_quality(steady, duration_ms=2000, ffmpeg=ffmpeg)
    flicker_metrics = await score_video_quality(flicker, duration_ms=2000, ffmpeg=ffmpeg)

    assert flicker_metrics.flicker_stddev > steady_metrics.flicker_stddev + 5


async def test_undecodable_bytes_are_unavailable_not_an_error(ffmpeg):
    metrics = await score_video_quality(b"\x00" * 64, duration_ms=2000, ffmpeg=ffmpeg)

    assert metrics.status == "UNAVAILABLE"
    assert metrics.reason
    assert metrics.freeze_total_ms is None


async def test_missing_binary_is_unavailable_not_an_error():
    metrics = await score_video_quality(b"x", duration_ms=2000, ffmpeg="no-such-ffmpeg-binary")

    assert metrics.status == "UNAVAILABLE"
    assert metrics.reason


async def test_timeout_is_unavailable_not_an_error(tmp_path, ffmpeg):
    data = await _clip(ffmpeg, tmp_path / "slow.mp4", MOVING)

    metrics = await score_video_quality(
        data, duration_ms=2000, ffmpeg=ffmpeg, timeout_seconds=0.001
    )

    assert metrics.status == "UNAVAILABLE"
    assert "timed out" in metrics.reason


async def test_good_clip_has_no_tail_freeze_or_white_and_reports_colour_spread(tmp_path, ffmpeg):
    data = await _clip(ffmpeg, tmp_path / "good-v2.mp4", MOVING)

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert metrics.freeze_tail_ms == 0
    assert metrics.white_total_ms == 0
    assert metrics.stddev_y is not None and metrics.stddev_y >= 0
    assert metrics.stddev_u is not None and metrics.stddev_v is not None
    assert metrics.low_y is not None and metrics.high_y is not None
    assert metrics.low_y < metrics.high_y


async def test_frozen_ending_is_measured_as_freeze_tail_not_head(tmp_path, ffmpeg):
    video = f"{MOVING}:d=1[a];color=c=gray:size=1280x720:rate=24:d=1[b];[a][b]concat=n=2:v=1:a=0"
    data = await _clip(ffmpeg, tmp_path / "tail-v2.mp4", video)

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert metrics.freeze_head_ms == 0
    assert 900 <= metrics.freeze_tail_ms <= 1100


async def test_frozen_opening_is_not_a_freeze_tail(tmp_path, ffmpeg):
    video = f"color=c=gray:size=1280x720:rate=24:d=1[a];{MOVING}:d=1[b];[a][b]concat=n=2:v=1:a=0"
    data = await _clip(ffmpeg, tmp_path / "head-v2.mp4", video)

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert metrics.freeze_tail_ms == 0


async def test_white_clip_reports_white_duration(tmp_path, ffmpeg):
    data = await _clip(ffmpeg, tmp_path / "white.mp4", "color=c=white:size=1280x720:rate=24")

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert 1800 <= metrics.white_total_ms <= 2000
    assert metrics.black_total_ms == 0


async def test_black_clip_is_not_white(tmp_path, ffmpeg):
    data = await _clip(ffmpeg, tmp_path / "black-v2.mp4", "color=c=black:size=1280x720:rate=24")

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert metrics.white_total_ms == 0


async def test_a_brief_white_flash_counts_only_its_own_duration(tmp_path, ffmpeg):
    video = (
        f"{MOVING}:d=0.75[a];color=c=white:size=1280x720:rate=24:d=0.5[b];"
        f"{MOVING}:d=0.75[c];[a][b][c]concat=n=3:v=1:a=0"
    )
    data = await _clip(ffmpeg, tmp_path / "flash.mp4", video)

    metrics = await score_video_quality(data, duration_ms=2000, ffmpeg=ffmpeg)

    assert 400 <= metrics.white_total_ms <= 650


async def test_colour_spread_is_larger_when_the_scene_changes_colour(tmp_path, ffmpeg):
    gray = "color=c=gray:size=640x360:rate=24"
    steady = await _clip(ffmpeg, tmp_path / "steady-colour.mp4", gray)
    video = (
        "color=c=black:size=640x360:rate=24:d=1[a];"
        "color=c=white:size=640x360:rate=24:d=1[b];[a][b]concat=n=2:v=1:a=0"
    )
    shifting = await _clip(ffmpeg, tmp_path / "shifting-colour.mp4", video)

    steady_metrics = await score_video_quality(steady, duration_ms=2000, ffmpeg=ffmpeg)
    shifting_metrics = await score_video_quality(shifting, duration_ms=2000, ffmpeg=ffmpeg)

    assert shifting_metrics.stddev_y > steady_metrics.stddev_y + 20
