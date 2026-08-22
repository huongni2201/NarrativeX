import pytest
from pydantic import ValidationError

from narrativex_worker.config import WorkerSettings


def test_r2_endpoint_is_derived_from_account_id(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("R2_ACCOUNT_ID", "account-123")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "access-key")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "secret-key")
    monkeypatch.setenv("R2_BUCKET", "narrativex-dev")

    settings = WorkerSettings()

    assert settings.resolved_r2_endpoint == "https://account-123.r2.cloudflarestorage.com"
    assert settings.r2_bucket == "narrativex-dev"
    assert settings.r2_access_key_id is not None
    assert settings.r2_access_key_id.get_secret_value() == "access-key"
    assert settings.r2_secret_access_key is not None
    assert settings.r2_secret_access_key.get_secret_value() == "secret-key"


def test_explicit_r2_endpoint_is_normalized(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("R2_ACCOUNT_ID", "ignored-account")
    monkeypatch.setenv("R2_ENDPOINT", "https://example.r2.cloudflarestorage.com/")

    settings = WorkerSettings()

    assert settings.resolved_r2_endpoint == "https://example.r2.cloudflarestorage.com"


def test_r2_endpoint_is_none_without_endpoint_or_account() -> None:
    settings = WorkerSettings()

    assert settings.resolved_r2_endpoint is None


def test_r2_runtime_requires_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MEDIA_STORAGE_MODE", "r2")
    monkeypatch.setenv("R2_ACCOUNT_ID", "account-123")

    with pytest.raises(ValidationError, match="R2_ACCESS_KEY_ID"):
        WorkerSettings()


def test_google_tts_requires_project(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TTS_PROVIDER_MODE", "google")

    with pytest.raises(ValidationError, match="GOOGLE_TTS_PROJECT_ID"):
        WorkerSettings()


def test_tts_requires_r2_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TTS_PROVIDER_MODE", "google")
    monkeypatch.setenv("GOOGLE_TTS_PROJECT_ID", "project-123")

    with pytest.raises(ValidationError, match="MEDIA_STORAGE_MODE=r2"):
        WorkerSettings()


def test_vieneu_voice_settings_are_available_without_provider_credentials() -> None:
    settings = WorkerSettings(
        worker_env="test",
        vieneu_voice_id="vieneu-ngoc-huyen-v2",
        vieneu_voice_name="Ngọc Huyền v2",
    )

    assert settings.vieneu_backend == "auto"
    assert settings.vieneu_precision == "int8"
    assert settings.vieneu_apply_watermark is False
