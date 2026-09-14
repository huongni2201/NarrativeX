import pytest
from pydantic import ValidationError

from narrativex_worker.__main__ import _database_target
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


def test_project_media_local_dir_is_explicit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROJECT_MEDIA_LOCAL_DIR", "/tmp/narrativex-project-media")

    settings = WorkerSettings()

    assert settings.project_media_local_dir == "/tmp/narrativex-project-media"


def test_removed_media_compatibility_aliases_stay_removed() -> None:
    settings = WorkerSettings(project_media_local_dir="/tmp/project-media")

    assert settings.project_media_local_dir == "/tmp/project-media"
    assert not hasattr(settings, "media_storage_mode")
    assert not hasattr(settings, "media_local_dir")


def test_removed_provider_settings_stay_removed() -> None:
    settings = WorkerSettings()

    for field_name in (
        "google_tts_project_id",
        "google_tts_endpoint",
        "google_tts_timeout_seconds",
        "wan_video_enabled",
        "wan_endpoint_url",
        "wan_model",
        "wan_api_token",
        "wan_request_timeout_seconds",
    ):
        assert not hasattr(settings, field_name)


def test_removed_tts_modes_are_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TTS_PROVIDER_MODE", "google")

    with pytest.raises(ValidationError, match="disabled.*fake.*voicestudio"):
        WorkerSettings()


def test_voicestudio_does_not_require_project_media_r2() -> None:
    settings = WorkerSettings(tts_provider_mode="voicestudio")

    assert settings.tts_provider_mode == "voicestudio"
    assert settings.project_media_local_dir


def test_voicestudio_settings_target_one_persistent_local_service() -> None:
    settings = WorkerSettings(
        worker_env="test",
        voicestudio_voice_id="voicestudio-default",
        voicestudio_voice_profile_id="default",
    )

    assert settings.voicestudio_base_url == "http://voicestudio:3900"
    assert settings.voicestudio_model == "tts-1"
    assert settings.voicestudio_inference_concurrency == 1
    assert settings.tts_segment_batch_size == 8


def test_voicestudio_base_url_rejects_public_service_for_production() -> None:
    with pytest.raises(ValidationError, match="loopback/private/local"):
        WorkerSettings(
            worker_env="production",
            worker_roles="narration",
            tts_provider_mode="voicestudio",
            voicestudio_base_url="https://speech.example.com",
        )


def test_production_narration_requires_voicestudio() -> None:
    with pytest.raises(ValidationError, match="TTS_PROVIDER_MODE=voicestudio"):
        WorkerSettings(worker_env="production", worker_roles="narration")


def test_production_narration_accepts_private_voicestudio() -> None:
    settings = WorkerSettings(
        worker_env="production",
        worker_roles="narration",
        tts_provider_mode="voicestudio",
        voicestudio_base_url="http://voicestudio:3900",
    )

    assert settings.tts_provider_mode == "voicestudio"


def test_qwen_analysis_defaults_target_single_gpu_execution() -> None:
    settings = WorkerSettings()

    assert settings.qwen_base_url == "http://qwen:8000/v1"
    assert settings.qwen_model == "Qwen/Qwen3-8B-AWQ"
    assert settings.qwen_analysis_shard_concurrency == 1
    assert settings.qwen_analysis_shard_target_beats == 12
    assert settings.qwen_analysis_shard_max_beats == 20
    assert settings.qwen_analysis_repair_attempts == 1


def test_qwen_analysis_shard_concurrency_rejects_more_than_two() -> None:
    with pytest.raises(ValidationError):
        WorkerSettings(qwen_analysis_shard_concurrency=3)


def test_qwen_analysis_max_beats_cannot_be_lower_than_target() -> None:
    with pytest.raises(ValidationError, match="max beats"):
        WorkerSettings(
            qwen_analysis_shard_target_beats=16,
            qwen_analysis_shard_max_beats=12,
        )


def test_production_analysis_worker_requires_qwen() -> None:
    with pytest.raises(ValidationError, match="AI_PROVIDER_MODE=qwen"):
        WorkerSettings(worker_env="production", worker_roles="analysis")


def test_production_analysis_worker_accepts_qwen() -> None:
    settings = WorkerSettings(
        worker_env="production",
        worker_roles="analysis",
        provider_mode="qwen",
        qwen_base_url="http://qwen:8000/v1",
    )

    assert settings.provider_mode == "qwen"


def test_production_analysis_worker_rejects_public_qwen_endpoint() -> None:
    with pytest.raises(ValidationError, match="loopback/private/local"):
        WorkerSettings(
            worker_env="production",
            worker_roles="analysis",
            provider_mode="qwen",
            qwen_base_url="https://public-model-api.example.com/v1",
        )


def test_worker_roles_can_isolate_narration() -> None:
    settings = WorkerSettings(worker_roles="narration")

    assert settings.has_worker_role("narration")
    assert not settings.has_worker_role("analysis")


def test_build_sha_is_loaded_for_startup_diagnostics() -> None:
    settings = WorkerSettings(build_sha="9fd428a")

    assert settings.build_sha == "9fd428a"


def test_database_target_does_not_include_credentials() -> None:
    database_url = "postgresql://user:secret@postgres:5432/narrativex"  # secret-scan: allow
    assert _database_target(database_url) == (
        "postgres",
        5432,
        "narrativex",
    )


def test_unknown_worker_role_is_rejected() -> None:
    with pytest.raises(ValidationError, match="Unsupported WORKER_ROLES"):
        WorkerSettings(worker_roles="narration,unknown")


def test_removed_translation_worker_role_is_rejected() -> None:
    with pytest.raises(ValidationError, match="Unsupported WORKER_ROLES"):
        WorkerSettings(worker_roles="translation")


def test_image_generation_defaults_to_gemini_flash_image_batch_configuration() -> None:
    settings = WorkerSettings()

    assert settings.vertex_image_model == "gemini-2.5-flash-image"
    assert settings.vertex_image_location == "global"
    assert settings.vertex_image_service_tier == "standard"
    assert settings.vertex_image_batch_gcs_bucket is None


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
        )


def test_enabled_image_uses_local_project_media_without_r2() -> None:
    settings = WorkerSettings(
        image_provider_mode="vertex",
        vertex_project_id="project-123",
        vertex_image_batch_gcs_bucket="image-batches",
    )

    assert settings.image_provider_mode == "vertex"
    assert settings.project_media_local_dir


def test_disabled_image_provider_does_not_require_batch_bucket() -> None:
    settings = WorkerSettings()

    assert settings.image_provider_mode == "disabled"
    assert settings.vertex_image_batch_gcs_bucket is None


def test_production_image_worker_rejects_disabled_provider() -> None:
    with pytest.raises(ValidationError, match="IMAGE_PROVIDER_MODE=vertex"):
        WorkerSettings(worker_env="production", worker_roles="image-generation")


def test_production_image_worker_accepts_real_provider_with_local_project_media() -> None:
    settings = WorkerSettings(
        worker_env="production",
        worker_roles="image-generation",
        image_provider_mode="vertex",
        vertex_project_id="project-123",
        vertex_image_batch_gcs_bucket="image-batches",
        project_media_local_dir="/data/narrativex/projects",
    )

    assert settings.image_provider_mode == "vertex"
    assert settings.project_media_local_dir == "/data/narrativex/projects"
