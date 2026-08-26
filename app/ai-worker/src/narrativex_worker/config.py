"""Worker configuration module.

Production Google authentication comes from ADC/workload identity at runtime. Provider credentials
are never copied into durable job payloads.
"""

from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

WORKER_ROLE_NAMES = {
    "analysis",
    "translation",
    "narration",
    "media-validation",
    "image-generation",
}


class WorkerSettings(BaseSettings):
    """NarrativeX Worker settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    worker_name: str = Field(default="narrativex-worker", description="Identifier of the worker")
    worker_env: str = Field(default="development", description="Environment stage")
    worker_roles: str = Field(
        default="analysis,translation,narration,media-validation,image-generation",
        validation_alias=AliasChoices("WORKER_ROLES"),
        description="Comma-separated worker roles hosted by this process",
    )
    log_level: str = Field(default="INFO", description="Logging level")
    build_sha: str = Field(
        default="unknown",
        validation_alias=AliasChoices("BUILD_SHA", "NARRATIVEX_BUILD_SHA"),
        description="Immutable application/image revision reported in startup diagnostics",
    )
    backend_url: str = Field(default="http://localhost:8080", description="Backend service URL")
    health_check_port: int = Field(default=8001, description="Worker health port")
    database_url: str = Field(
        default="postgresql://narrativex:narrativex@localhost:5432/narrativex",
        description="PostgreSQL URL used for durable claim/lease and result materialization",
    )
    poll_interval_seconds: float = Field(default=1.0, gt=0, le=60)
    lease_seconds: int = Field(default=60, ge=10, le=3600)
    worker_concurrency: int = Field(
        default=4,
        ge=1,
        le=32,
        description="Maximum jobs processed concurrently by one worker process",
    )
    media_download_timeout_seconds: float = Field(default=120.0, gt=1, le=900)
    media_probe_timeout_seconds: float = Field(default=30.0, gt=1, le=300)
    media_max_audio_bytes: int = Field(default=100 * 1024 * 1024, ge=1024, le=500 * 1024 * 1024)
    media_max_image_bytes: int = Field(default=100 * 1024 * 1024, ge=1024, le=500 * 1024 * 1024)
    media_max_video_bytes: int = Field(
        default=1024 * 1024 * 1024, ge=1024, le=2 * 1024 * 1024 * 1024
    )

    provider_mode: Literal["disabled", "fake", "vertex"] = Field(
        default="disabled",
        validation_alias=AliasChoices("AI_PROVIDER_MODE", "PROVIDER_MODE"),
        description="Story-analysis provider adapter mode; disabled is safe by default",
    )
    vertex_project_id: str | None = None
    vertex_location: str = "us-central1"
    vertex_model: str = "gemini-2.5-flash"
    vertex_timeout_seconds: float = Field(default=120.0, gt=1, le=600)
    image_provider_mode: Literal["disabled", "fake", "vertex"] = Field(
        default="disabled", validation_alias=AliasChoices("IMAGE_PROVIDER_MODE")
    )
    vertex_image_model: str = "gemini-2.5-flash-image"
    vertex_image_location: str = "global"
    vertex_image_timeout_seconds: float = Field(default=120.0, gt=1, le=1800)
    vertex_image_service_tier: Literal["standard", "flex"] = "standard"
    vertex_image_batch_max_items: int = Field(default=50, ge=1, le=1000)
    vertex_image_batch_location: str = "global"
    vertex_image_batch_gcs_bucket: str | None = None
    vertex_image_batch_gcs_prefix: str = "narrativex/image-batches"
    vertex_image_batch_poll_seconds: float = Field(default=30.0, ge=5.0, le=300.0)
    vertex_image_batch_http_timeout_seconds: float = Field(default=120.0, gt=1, le=600)
    vertex_image_unknown_max_age_seconds: int = Field(default=3600, ge=60, le=86_400)
    image_reconcile_max_attempts: int = Field(default=5, ge=1, le=100)
    image_circuit_breaker_failure_threshold: int = Field(default=3, ge=1, le=100)
    image_circuit_breaker_open_seconds: int = Field(default=120, ge=1, le=86_400)
    image_max_output_bytes: int = Field(default=15_000_000, ge=1024, le=50_000_000)

    tts_provider_mode: Literal["disabled", "fake", "vieneu"] = Field(
        default="disabled",
        validation_alias=AliasChoices("TTS_PROVIDER_MODE", "NARRATION_PROVIDER_MODE"),
    )
    google_tts_project_id: str | None = None
    google_tts_endpoint: str = "https://texttospeech.googleapis.com"
    google_tts_timeout_seconds: float = Field(default=120.0, gt=1, le=600)
    tts_pricing_catalog_version: str = "vieneu-local-2026-08-23"
    narration_mp3_bitrate: Literal["64k", "80k", "96k", "112k", "128k", "160k", "192k"] = "96k"
    vieneu_voice_id: str = "vieneu-ngoc-huyen-v2"
    vieneu_voice_name: str = "Ngọc Huyền v2"
    vieneu_reference_audio_path: str | None = None
    vieneu_backend: Literal["auto", "onnx", "pytorch"] = "auto"
    vieneu_precision: Literal["int8", "fp32"] = "int8"
    vieneu_threads: int = Field(default=0, ge=0, le=64)
    vieneu_batch_max_segments: int = Field(default=8, ge=1, le=64)
    vieneu_max_batch_size: int = Field(default=32, ge=1, le=128)
    vieneu_inference_concurrency: int = Field(default=1, ge=1, le=4)
    vieneu_denoise_reference: bool = True
    vieneu_save_voice_profile: bool = False
    vieneu_force_reenroll: bool = False
    vieneu_apply_watermark: bool = False

    media_storage_mode: Literal["disabled", "local", "r2"] = Field(
        default="disabled",
        validation_alias=AliasChoices("MEDIA_STORAGE_MODE"),
        description="Durable generated-media storage mode; Cloudflare R2 is the object-store runtime",
    )
    r2_account_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("R2_ACCOUNT_ID"),
        description="Cloudflare account ID used to derive the R2 S3-compatible endpoint",
    )
    r2_access_key_id: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("R2_ACCESS_KEY_ID"),
        description="Cloudflare R2 API access key ID",
    )
    r2_secret_access_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("R2_SECRET_ACCESS_KEY"),
        description="Cloudflare R2 API secret access key",
    )
    r2_bucket: str = Field(
        default="narrativex-dev",
        min_length=1,
        validation_alias=AliasChoices("R2_BUCKET", "R2_BUCKET_NAME"),
        description="R2 bucket that owns durable generated media for this environment",
    )
    r2_endpoint: str | None = Field(
        default=None,
        validation_alias=AliasChoices("R2_ENDPOINT", "R2_ENDPOINT_URL"),
        description="Optional R2 endpoint override; normally derived from r2_account_id",
    )
    media_local_dir: str = Field(
        default="/tmp/narrativex-e2e/media",
        validation_alias=AliasChoices("MEDIA_LOCAL_DIR"),
    )

    wan_video_enabled: bool = False
    wan_endpoint_url: str | None = None
    wan_model: str = "Wan2.2-TI2V-5B"
    wan_api_token: SecretStr | None = None
    wan_request_timeout_seconds: float = Field(default=30.0, gt=1, le=300)

    @field_validator("worker_roles")
    @classmethod
    def validate_worker_roles(cls, value: str) -> str:
        roles = {item.strip() for item in value.split(",") if item.strip()}
        if not roles:
            raise ValueError("WORKER_ROLES must include at least one worker role")
        unknown = roles - WORKER_ROLE_NAMES
        if unknown:
            raise ValueError("Unsupported WORKER_ROLES: " + ", ".join(sorted(unknown)))
        return ",".join(sorted(roles))

    def has_worker_role(self, role: str) -> bool:
        return role in {item.strip() for item in self.worker_roles.split(",") if item.strip()}

    @computed_field  # type: ignore[prop-decorator]
    @property
    def resolved_r2_endpoint(self) -> str | None:
        """Return the explicit R2 endpoint or derive the canonical Cloudflare endpoint."""
        if self.r2_endpoint and self.r2_endpoint.strip():
            return self.r2_endpoint.strip().rstrip("/")
        if self.r2_account_id and self.r2_account_id.strip():
            return f"https://{self.r2_account_id.strip()}.r2.cloudflarestorage.com"
        return None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def normalized_vertex_image_batch_prefix(self) -> str:
        return self.vertex_image_batch_gcs_prefix.strip().strip("/")

    @model_validator(mode="after")
    def validate_narration_runtime(self) -> "WorkerSettings":
        if self.worker_env.strip().lower() in {"production", "prod"}:
            self._validate_production_runtime()
        if self.image_provider_mode == "vertex" and not self.vertex_project_id:
            raise ValueError("VERTEX_PROJECT_ID is required when IMAGE_PROVIDER_MODE=vertex")
        if self.vertex_image_service_tier == "flex":
            if self.vertex_image_location != "global":
                raise ValueError("Vertex image Flex PayGo requires VERTEX_IMAGE_LOCATION=global")
            if self.vertex_image_model == "gemini-2.5-flash-image":
                raise ValueError(
                    "gemini-2.5-flash-image does not support Flex PayGo; use the standard tier "
                    "or Vertex batch inference for the 50% discounted rate"
                )
        if self.image_provider_mode == "vertex":
            if not self.vertex_image_batch_gcs_bucket or not self.vertex_image_batch_gcs_bucket.strip():
                raise ValueError(
                    "VERTEX_IMAGE_BATCH_GCS_BUCKET is required when IMAGE_PROVIDER_MODE=vertex"
                )
        if not self.normalized_vertex_image_batch_prefix:
            raise ValueError("VERTEX_IMAGE_BATCH_GCS_PREFIX must not be blank")
        if self.tts_provider_mode == "vieneu":
            if not self.vieneu_voice_id.strip():
                raise ValueError("VIENEU_VOICE_ID must not be blank")
            if not self.vieneu_voice_name.strip():
                raise ValueError("VIENEU_VOICE_NAME must not be blank")
        if self.image_provider_mode not in {"disabled", "fake"} and self.media_storage_mode != "r2":
            raise ValueError("Image generation requires MEDIA_STORAGE_MODE=r2")
        if self.media_storage_mode == "r2":
            missing: list[str] = []
            if not self.resolved_r2_endpoint:
                missing.append("R2_ACCOUNT_ID or R2_ENDPOINT")
            if self.r2_access_key_id is None or not self.r2_access_key_id.get_secret_value().strip():
                missing.append("R2_ACCESS_KEY_ID")
            if self.r2_secret_access_key is None or not self.r2_secret_access_key.get_secret_value().strip():
                missing.append("R2_SECRET_ACCESS_KEY")
            if not self.r2_bucket.strip():
                missing.append("R2_BUCKET")
            if missing:
                raise ValueError("Missing R2 settings: " + ", ".join(missing))
        if self.tts_provider_mode not in {"disabled", "fake"} and self.media_storage_mode != "r2":
            raise ValueError("External narration TTS requires durable MEDIA_STORAGE_MODE=r2")
        return self

    def _validate_production_runtime(self) -> None:
        """Prevent a production worker container from silently selecting test/local adapters."""
        errors: list[str] = []
        if self.has_worker_role("analysis") and self.provider_mode != "vertex":
            errors.append("AI_PROVIDER_MODE=vertex is required for production analysis")
        if self.has_worker_role("image-generation") and self.image_provider_mode != "vertex":
            errors.append("IMAGE_PROVIDER_MODE=vertex is required for production image generation")
        if self.has_worker_role("narration") and self.tts_provider_mode != "vieneu":
            errors.append("TTS_PROVIDER_MODE=vieneu is required for production narration")
        if (
            self.has_worker_role("image-generation") or self.has_worker_role("narration")
        ) and self.media_storage_mode != "r2":
            errors.append("MEDIA_STORAGE_MODE=r2 is required for production media workers")
        if errors:
            raise ValueError("Invalid production worker configuration: " + "; ".join(errors))


def get_settings() -> WorkerSettings:
    """Return an initialized instance of WorkerSettings."""
    return WorkerSettings()
