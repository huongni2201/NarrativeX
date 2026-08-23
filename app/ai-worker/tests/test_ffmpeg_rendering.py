from pathlib import Path

import pytest

from narrativex_worker.rendering.effects import AnimatedText, RenderEffects
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


def test_default_graph_preserves_legacy_output_contract(tmp_path: Path) -> None:
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


@pytest.mark.parametrize(
    ("transition", "needle"),
    [
        ("FADE", "blend="),
        ("DISSOLVE", "mod(X*17+Y*13"),
        ("SLIDE_LEFT", "overlay="),
        ("ZOOM", "0.86+0.14"),
        ("WIPE_LEFT", "lte(X/W"),
    ],
)
def test_transition_catalog_compiles(tmp_path: Path, transition: str, needle: str) -> None:
    effects = RenderEffects(transition=transition, transition_seconds=0.25)
    command = " ".join(build_ffmpeg_args(_manifest(tmp_path, effects=effects)))
    assert needle in command


def test_cinematic_profile_compiles_all_effect_layers(tmp_path: Path) -> None:
    effects = RenderEffects(
        transition="AUTO",
        transition_seconds=0.25,
        color_grade="CINEMATIC",
        background_mode="BLUR",
        overlay_style="FILM_GRAIN_VIGNETTE",
        overlay_path=tmp_path / "atmosphere.mov",
        watermark_path=tmp_path / "logo.png",
        bgm_path=tmp_path / "music.mp3",
        motion_easing="EASE_IN_OUT",
        text_overlays=(
            AnimatedText("NarrativeX", 0.2, 1.5, style="SLIDE", position="TOP"),
            AnimatedText("Chapter 1", 1.5, 4.5, style="TYPEWRITER"),
        ),
    )
    command = " ".join(build_ffmpeg_args(_manifest(tmp_path, effects=effects)))

    assert "gblur=" in command
    assert "colorbalance=" in command
    assert "noise=" in command
    assert "vignette=" in command
    assert "colorchannelmixer=" in command
    assert "sidechaincompress=" in command
    assert "amix=" in command
    assert "drawtext=" in command
    assert "3-2*" in command


@pytest.mark.parametrize("grade", ["WARM", "COOL", "HORROR", "FANTASY"])
def test_builtin_color_grades_compile(tmp_path: Path, grade: str) -> None:
    effects = RenderEffects(color_grade=grade)
    command = " ".join(build_ffmpeg_args(_manifest(tmp_path, effects=effects)))
    assert "colorbalance=" in command


def test_lut3d_profile_compiles(tmp_path: Path) -> None:
    effects = RenderEffects(lut_path=tmp_path / "cinematic.cube")
    command = " ".join(build_ffmpeg_args(_manifest(tmp_path, effects=effects)))
    assert "lut3d=" in command
    assert "tetrahedral" in command


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


def test_auto_encoder_compiles_portably_as_libx264_before_runtime_probe(tmp_path: Path) -> None:
    command = " ".join(build_ffmpeg_args(_manifest(tmp_path, video_encoder="auto")))
    assert "-vcodec libx264" in command


def test_render_manifest_rejects_unknown_encoder(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="unsupported video encoder"):
        build_ffmpeg_args(_manifest(tmp_path, video_encoder="unknown"))


def test_render_effects_reject_unknown_transition(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="unsupported transition"):
        build_ffmpeg_args(_manifest(tmp_path, effects=RenderEffects(transition="TELEPORT")))
