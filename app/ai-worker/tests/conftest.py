from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def isolate_settings_environment(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """Keep settings tests independent from a developer shell or local .env."""
    monkeypatch.chdir(tmp_path)
    for key in (
        "AI_PROVIDER_MODE",
        "PROVIDER_MODE",
        "TTS_PROVIDER_MODE",
        "NARRATION_PROVIDER_MODE",
        "GOOGLE_TTS_PROJECT_ID",
        "PROJECT_MEDIA_LOCAL_DIR",
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
        "R2_BUCKET_NAME",
        "R2_ENDPOINT",
        "R2_ENDPOINT_URL",
        "WORKER_CONCURRENCY",
        "VIENEU_VOICE_ID",
        "VIENEU_VOICE_NAME",
        "VIENEU_REFERENCE_AUDIO_PATH",
        "VIENEU_BACKEND",
        "VIENEU_PRECISION",
        "VIENEU_THREADS",
        "VIENEU_DENOISE_REFERENCE",
        "VIENEU_SAVE_VOICE_PROFILE",
        "VIENEU_FORCE_REENROLL",
        "VIENEU_APPLY_WATERMARK",
    ):
        monkeypatch.delenv(key, raising=False)
