import copy

import pytest

from narrativex_worker.rendering.profile import RenderProfile


PROFILE = {
    "schemaVersion": 1,
    "engine": "ffmpeg-python",
    "rendererVersion": "image-motion-v6-profiled-cinematic",
    "fps": 30,
    "video": {
        "encoder": "libx264",
        "x264Preset": "veryfast",
        "crf": 20,
        "nvencPreset": "p5",
        "nvencCq": 21,
        "pixelFormat": "yuv420p",
    },
    "audio": {"codec": "aac", "bitrate": "192k", "sampleRate": 48000},
    "effects": {
        "transition": "LEGACY_FADE",
        "transitionSeconds": 0.12,
        "colorGrade": "NONE",
        "backgroundMode": "COVER",
        "backgroundBlurSigma": 22.0,
        "overlayStyle": "NONE",
        "overlayOpacity": 0.30,
        "watermarkWidthRatio": 0.12,
        "watermarkOpacity": 0.82,
        "watermarkPosition": "TOP_RIGHT",
        "bgmVolume": 0.18,
        "duckThreshold": 0.08,
        "duckRatio": 8.0,
        "duckAttackMs": 20.0,
        "duckReleaseMs": 350.0,
        "motionEasing": "LINEAR",
        "textOverlays": [],
        "lutAsset": None,
        "overlayAsset": None,
        "watermarkAsset": None,
        "bgmAsset": None,
    },
    "subtitles": {"mode": "burned-ass"},
}


def test_profile_round_trips_to_fingerprint_payload() -> None:
    profile = RenderProfile.from_json(PROFILE)
    assert profile.fingerprint_payload() == PROFILE
    assert profile.effects.transition == "LEGACY_FADE"
    assert profile.video_encoder == "libx264"


def test_renderer_version_changes_profile_identity() -> None:
    first = RenderProfile.from_json(PROFILE).fingerprint_payload()
    changed = copy.deepcopy(PROFILE)
    changed["rendererVersion"] = "image-motion-v7"
    second = RenderProfile.from_json(changed).fingerprint_payload()
    assert first != second


def test_unpinned_external_effect_is_rejected() -> None:
    changed = copy.deepcopy(PROFILE)
    changed["effects"]["bgmAsset"] = {"id": "bgm-1", "checksum": "a" * 64}
    with pytest.raises(ValueError, match="external effects"):
        RenderProfile.from_json(changed)
