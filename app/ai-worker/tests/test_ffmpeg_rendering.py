from pathlib import Path

import pytest

from narrativex_worker.rendering.ffmpeg import build_ffmpeg_args
from narrativex_worker.rendering.image_motion import ImageMotionManifest, MotionBeat


def _manifest(tmp_path: Path, **overrides: object) -> ImageMotionManifest:
    values: dict[str, object] = {
        "beats": (
            MotionBeat(tmp_path / "beat-1.png", 2.0, "PUSH_IN"),
            MotionBeat(tmp_path / "beat-2.png", 3.0, "PAN"),
        ),
        "audio_path": tmp_path / "narration.mp3",
        "output_path": tmp_path / "chapter.mp4",
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "subtitle_path": tmp_path / "subtitles.ass",
    }
    values.update(overrides)
    return ImageMotionManifest(**values)  # type: ignore[arg-type]


def test_ffmpeg_python_graph_contains_motion_transition_audio_and_faststart(
    tmp_path: Path,
) -> None:
    args = build_ffmpeg_args(_manifest(tmp_path))
    command = " ".join(args)

    assert args[0] == "ffmpeg"
    assert "zoompan=" in command
    assert "1+0.08*" in command
    assert "(iw-iw/zoom)*" in command
    assert "fade=" in command
    assert "concat=" in command
    assert "ass=filename=" in command
    assert "-vcodec libx264" in command
    assert "-preset veryfast" in command
    assert "-crf 20" in command
    assert "-acodec aac" in command
    assert "-b:a 192k" in command
    assert "-movflags +faststart" in command
    assert "-pix_fmt yuv420p" in command


def test_ffmpeg_python_graph_can_select_nvenc(tmp_path: Path) -> None:
    args = build_ffmpeg_args(
        _manifest(
            tmp_path,
            video_encoder="h264_nvenc",
            nvenc_preset="p5",
            nvenc_cq=21,
        )
    )
    command = " ".join(args)

    assert "-vcodec h264_nvenc" in command
    assert "-preset p5" in command
    assert "-cq 21" in command
    assert "-rc vbr" in command


def test_render_manifest_rejects_unknown_encoder(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="unsupported video encoder"):
        build_ffmpeg_args(_manifest(tmp_path, video_encoder="unknown"))
