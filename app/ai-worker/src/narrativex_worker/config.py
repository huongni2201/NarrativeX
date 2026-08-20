"""Worker configuration module.

Production Google authentication comes from ADC/workload identity at runtime. Provider credentials
are never copied into durable job payloads.
"""

from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, model_validator
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
    worker_concurrency: int = Field(default=4, ge=1, le=32)

    provider_mode: Literal["disabled", "vertex"] = Field(
        default="disabled",
        validation_alias=AliasChoices("AI_PROVIDER_MODE", "PROVIDER_MODE"),
        description="Story-analysis provider adapter mode; disabled is safe by default",
    )
    vertex_project_id: str | None = None
    vertex_location: str = "us-central1"
    vertex_model: str = "gemini-2.5-flash"
    vertex_timeout_seconds: float = Field(default=120.0, gt=1, le=600)

    tts_provider_mode: Literal["disabled", "google"] = Field(
        default="disabled",
        validation_alias=AliasChoices("TTS_PROVIDER_MODE", "NARRATION_PROVIDER_MODE"),
    )
    google_tts_project_id: str | None = None
    google_tts_endpoint: str = "https://texttospeech.googleapis.com"
    google_tts_timeout_seconds: float = Field(default=120.0, gt=1, le=600)
    tts_pricing_catalog_version: str = "google-tts-2026-08-20"

    media_storage_mode: Literal["disabled", "s3"] = "disabled"
    s3_endpoint_url: str | None = None
    s3_bucket: str | None = None
    s3_region: str = "auto"
    s3_access_key: SecretStr | None = None
    s3_secret_key: SecretStr | None = None

    wan_video_enabled: bool = False
    wan_endpoint_url: str | None = None
    wan_model: str = "Wan2.2-TI2V-5B"
    wan_api_token: SecretStr | None = None
    wan_request_timeout_seconds: float = Field(default=30.0, gt=1, le=300)

    @model_validator(mode="after")
    def validate_narration_runtime(self) -> "WorkerSettings":
        if self.tts_provider_mode == "google" and not self.google_tts_project_id:
            raise ValueError("GOOGLE_TTS_PROJECT_ID is required when TTS_PROVIDER_MODE=google")
        if self.media_storage_mode == "s3":
            required = {
                "S3_ENDPOINT_URL": self.s3_endpoint_url,
                "S3_BUCKET": self.s3_bucket,
                "S3_ACCESS_KEY": self.s3_access_key,
                "S3_SECRET_KEY": self.s3_secret_key,
            }
            missing = [name for name, value in required.items() if value is None]
            if missing:
                raise ValueError("Missing S3 settings: " + ", ".join(missing))
        if self.tts_provider_mode != "disabled" and self.media_storage_mode == "disabled":
            raise ValueError("Narration TTS requires durable MEDIA_STORAGE_MODE=s3")
        return self


def get_settings() -> WorkerSettings:
    return WorkerSettings()
