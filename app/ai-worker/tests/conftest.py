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
        "TTS_PROVIDER_MODE",
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
        "VOICESTUDIO_BASE_URL",
        "VOICESTUDIO_API_KEY",
        "VOICESTUDIO_MODEL",
        "VOICESTUDIO_VOICE_ID",
        "VOICESTUDIO_VOICE_PROFILE_ID",
        "VOICESTUDIO_TIMEOUT_SECONDS",
        "VOICESTUDIO_INFERENCE_CONCURRENCY",
        "TTS_SEGMENT_BATCH_SIZE",
    ):
        monkeypatch.delenv(key, raising=False)
