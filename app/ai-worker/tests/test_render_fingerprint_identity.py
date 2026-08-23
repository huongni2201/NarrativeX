from pathlib import Path

from narrativex_worker.rendering.effects import RenderEffects
from narrativex_worker.rendering.image_motion import ImageMotionManifest, MotionBeat
from narrativex_worker.rendering.worker import (
    RENDERER_SEMANTICS_VERSION,
    RENDER_FINGERPRINT_VERSION,
    _render_identity,
)


def _manifest(tmp_path: Path, **overrides: object) -> ImageMotionManifest:
    values: dict[str, object] = {
        "beats": (
            MotionBeat(
                image_path=tmp_path / "beat.png",
                duration_seconds=1.0,
                camera_movement="PAN",
            ),
        ),
        "audio_path": tmp_path / "audio.mp3",
        "output_path": tmp_path / "chapter.mp4",
        "width": 1280,
        "height": 720,
        "fps": 30,
        "effects": RenderEffects(),
    }
    values.update(overrides)
    return ImageMotionManifest(**values)  # type: ignore[arg-type]


def test_render_identity_contains_renderer_and_encoding_contract(tmp_path: Path) -> None:
    identity = _render_identity(_manifest(tmp_path))

    assert RENDER_FINGERPRINT_VERSION == "image-motion-render-v6-render-identity"
    assert identity["rendererSemanticsVersion"] == RENDERER_SEMANTICS_VERSION
    assert identity["fps"] == 30
    assert identity["encoding"] == {
        "videoEncoder": "libx264",
        "x264Preset": "veryfast",
        "crf": 20,
        "nvencPreset": "p5",
        "nvencCq": 21,
        "pixelFormat": "yuv420p",
        "audioCodec": "aac",
        "audioBitrate": "192k",
        "audioSampleRateHz": 48_000,
        "movflags": "+faststart",
    }


def test_render_identity_changes_when_encoder_quality_changes(tmp_path: Path) -> None:
    baseline = _render_identity(_manifest(tmp_path))
    changed = _render_identity(_manifest(tmp_path, crf=21, x264_preset="medium"))

    assert baseline != changed


def test_render_identity_changes_when_effects_change(tmp_path: Path) -> None:
    baseline = _render_identity(_manifest(tmp_path))
    changed = _render_identity(
        _manifest(
            tmp_path,
            effects=RenderEffects(
                transition="DISSOLVE",
                transition_seconds=0.35,
                color_grade="CINEMATIC",
                background_mode="AUTO",
                overlay_style="VIGNETTE",
                motion_easing="EASE_IN_OUT",
            ),
        )
    )

    assert baseline != changed
    effects = changed["effects"]
    assert isinstance(effects, dict)
    assert effects["transition"] == "DISSOLVE"
    assert effects["colorGrade"] == "CINEMATIC"
    assert effects["motionEasing"] == "EASE_IN_OUT"
