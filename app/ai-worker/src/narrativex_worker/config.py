"""Worker configuration module.

Production Google authentication comes from ADC/workload identity at runtime. Provider credentials
are never copied into durable job payloads.
"""

from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    log_level: str = Field(default="INFO", description="Logging level")
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

    provider_mode: Literal["disabled", "vertex"] = Field(
        default="disabled",
        validation_alias=AliasChoices("AI_PROVIDER_MODE", "PROVIDER_MODE"),
        description="Story-analysis provider adapter mode; disabled is safe by default",
    )
    vertex_project_id: str | None = None
    vertex_location: str = "us-central1"
    vertex_model: str = "gemini-2.5-flash"
    vertex_timeout_seconds: float = Field(default=120.0, gt=1, le=600)
    image_provider_mode: Literal["disabled", "vertex"] = Field(
        default="disabled", validation_alias=AliasChoices("IMAGE_PROVIDER_MODE")
    )
    vertex_image_model: str = "imagen-3.0-generate-002"
    vertex_image_location: str = "us-central1"
    vertex_image_timeout_seconds: float = Field(default=120.0, gt=1, le=600)
    image_max_output_bytes: int = Field(default=15_000_000, ge=1024, le=50_000_000)

    tts_provider_mode: Literal["disabled", "google"] = Field(
        default="disabled",
        validation_alias=AliasChoices("TTS_PROVIDER_MODE", "NARRATION_PROVIDER_MODE"),
    )
    google_tts_project_id: str | None = None
    google_tts_endpoint: str = "https://texttospeech.googleapis.com"
    google_tts_timeout_seconds: float = Field(default=120.0, gt=1, le=600)
    tts_pricing_catalog_version: str = "google-tts-2026-08-20"

    media_storage_mode: Literal["disabled", "r2"] = Field(
        default="disabled",
        validation_alias=AliasChoices("MEDIA_STORAGE_MODE"),
        description="Durable media storage mode; Cloudflare R2 is the only object-store runtime",
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

    wan_video_enabled: bool = False
    wan_endpoint_url: str | None = None
    wan_model: str = "Wan2.2-TI2V-5B"
    wan_api_token: SecretStr | None = None
    wan_request_timeout_seconds: float = Field(default=30.0, gt=1, le=300)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def resolved_r2_endpoint(self) -> str | None:
        """Return the explicit R2 endpoint or derive the canonical Cloudflare endpoint."""
        if self.r2_endpoint and self.r2_endpoint.strip():
            return self.r2_endpoint.strip().rstrip("/")
        if self.r2_account_id and self.r2_account_id.strip():
            return f"https://{self.r2_account_id.strip()}.r2.cloudflarestorage.com"
        return None

    @model_validator(mode="after")
    def validate_narration_runtime(self) -> "WorkerSettings":
        if self.image_provider_mode == "vertex" and not self.vertex_project_id:
            raise ValueError("VERTEX_PROJECT_ID is required when IMAGE_PROVIDER_MODE=vertex")
        if self.tts_provider_mode == "google" and not self.google_tts_project_id:
            raise ValueError("GOOGLE_TTS_PROJECT_ID is required when TTS_PROVIDER_MODE=google")
        if self.media_storage_mode == "r2":
            missing: list[str] = []
            if not self.resolved_r2_endpoint:
                missing.append("R2_ACCOUNT_ID or R2_ENDPOINT")
            if (
                self.r2_access_key_id is None
                or not self.r2_access_key_id.get_secret_value().strip()
            ):
                missing.append("R2_ACCESS_KEY_ID")
            if (
                self.r2_secret_access_key is None
                or not self.r2_secret_access_key.get_secret_value().strip()
            ):
                missing.append("R2_SECRET_ACCESS_KEY")
            if not self.r2_bucket.strip():
                missing.append("R2_BUCKET")
            if missing:
                raise ValueError("Missing R2 settings: " + ", ".join(missing))
        if self.tts_provider_mode != "disabled" and self.media_storage_mode != "r2":
            raise ValueError("Narration TTS requires durable MEDIA_STORAGE_MODE=r2")
        return self


def get_settings() -> WorkerSettings:
    """Return an initialized instance of WorkerSettings."""
    return WorkerSettings()
