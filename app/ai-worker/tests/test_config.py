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
    assert settings.vieneu_batch_max_segments == 8
    assert settings.vieneu_max_batch_size == 32
    assert settings.vieneu_inference_concurrency == 1
    assert settings.vieneu_save_voice_profile is False
    assert settings.vieneu_apply_watermark is False
    assert settings.narration_mp3_bitrate == "96k"


def test_worker_roles_can_isolate_narration() -> None:
    settings = WorkerSettings(worker_roles="narration")

    assert settings.has_worker_role("narration")
    assert not settings.has_worker_role("analysis")


def test_unknown_worker_role_is_rejected() -> None:
    with pytest.raises(ValidationError, match="Unsupported WORKER_ROLES"):
        WorkerSettings(worker_roles="narration,unknown")


def test_image_generation_defaults_to_batch_only_gemini_flash_image() -> None:
    settings = WorkerSettings()

    assert settings.vertex_image_model == "gemini-2.5-flash-image"
    assert settings.vertex_image_location == "global"
    assert settings.vertex_image_service_tier == "standard"
    assert settings.vertex_image_execution_mode == "batch"


def test_gemini_25_flash_image_rejects_flex_paygo() -> None:
    with pytest.raises(ValidationError, match="does not support Flex PayGo"):
        WorkerSettings(vertex_image_service_tier="flex")


def test_flex_requires_global_endpoint() -> None:
    with pytest.raises(ValidationError, match="requires VERTEX_IMAGE_LOCATION=global"):
        WorkerSettings(
            vertex_image_model="gemini-3.1-flash-image",
            vertex_image_location="us-central1",
            vertex_image_service_tier="flex",
        )


def test_enabled_vertex_requires_gcs_staging_bucket() -> None:
    with pytest.raises(ValidationError, match="VERTEX_IMAGE_BATCH_GCS_BUCKET"):
        WorkerSettings(
            image_provider_mode="vertex",
            vertex_project_id="project-123",
            vertex_image_execution_mode="batch",
        )


def test_enabled_image_requires_r2_storage() -> None:
    with pytest.raises(ValidationError, match="Image generation requires MEDIA_STORAGE_MODE=r2"):
        WorkerSettings(
            image_provider_mode="vertex",
            vertex_project_id="project-123",
            vertex_image_batch_gcs_bucket="image-batches",
        )


def test_enabled_image_requires_r2_credentials() -> None:
    with pytest.raises(ValidationError, match="R2_ACCESS_KEY_ID"):
        WorkerSettings(
            image_provider_mode="vertex",
            vertex_project_id="project-123",
            vertex_image_batch_gcs_bucket="image-batches",
            media_storage_mode="r2",
            r2_account_id="account-123",
        )


def test_disabled_image_provider_does_not_require_batch_bucket() -> None:
    settings = WorkerSettings()

    assert settings.image_provider_mode == "disabled"
    assert settings.vertex_image_execution_mode == "batch"
    assert settings.vertex_image_batch_gcs_bucket is None


def test_production_image_worker_rejects_disabled_provider() -> None:
    with pytest.raises(ValidationError, match="IMAGE_PROVIDER_MODE=vertex"):
        WorkerSettings(worker_env="production", worker_roles="image-generation")


def test_production_image_worker_accepts_real_provider_and_r2() -> None:
    settings = WorkerSettings(
        worker_env="production",
        worker_roles="image-generation",
        image_provider_mode="vertex",
        vertex_project_id="project-123",
        vertex_image_batch_gcs_bucket="image-batches",
        media_storage_mode="r2",
        r2_account_id="account-123",
        r2_access_key_id="access-key",
        r2_secret_access_key="secret-key",
    )

    assert settings.image_provider_mode == "vertex"
    assert settings.media_storage_mode == "r2"


@pytest.mark.parametrize("execution_mode", ["online", "auto"])
def test_non_batch_vertex_execution_modes_are_rejected(execution_mode: str) -> None:
    with pytest.raises(ValidationError, match="batch"):
        WorkerSettings(vertex_image_execution_mode=execution_mode)  # type: ignore[arg-type]
