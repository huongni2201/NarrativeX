"""Worker configuration module.

Production Vertex authentication comes from ADC/workload identity at runtime. Provider credentials
are never copied into durable job payloads.
"""

from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, computed_field
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
        description="Maximum Chapter analysis jobs processed concurrently by one worker process",
    )
    provider_mode: Literal["disabled", "vertex"] = Field(
        default="disabled",
        validation_alias=AliasChoices("AI_PROVIDER_MODE", "PROVIDER_MODE"),
        description="Story-analysis provider adapter mode; disabled is safe by default",
    )
    vertex_project_id: str | None = Field(
        default=None, description="Google Cloud project for Vertex AI"
    )
    vertex_location: str = Field(default="us-central1", description="Vertex AI region")
    vertex_model: str = Field(default="gemini-2.5-flash", description="Configured Gemini model key")
    vertex_timeout_seconds: float = Field(default=120.0, gt=1, le=600)

    r2_account_id: str | None = Field(
        default=None,
        description="Cloudflare account ID used to derive the R2 S3-compatible endpoint",
    )
    r2_access_key_id: SecretStr | None = Field(
        default=None,
        description="Cloudflare R2 API access key ID",
    )
    r2_secret_access_key: SecretStr | None = Field(
        default=None,
        description="Cloudflare R2 API secret access key",
    )
    r2_bucket: str = Field(
        default="narrativex-dev",
        min_length=1,
        description="R2 bucket that owns durable generated media for this environment",
    )
    r2_endpoint: str | None = Field(
        default=None,
        description="Optional R2 endpoint override; normally derived from r2_account_id",
    )

    wan_video_enabled: bool = Field(
        default=False,
        description="Enable HYBRID_LOCAL_I2V submission to a configured Wan inference endpoint",
    )
    wan_endpoint_url: str | None = Field(
        default=None,
        description="Base URL of the private/self-hosted Wan-compatible inference endpoint",
    )
    wan_model: str = Field(
        default="Wan2.2-TI2V-5B",
        min_length=1,
        max_length=128,
        description="Configured local Wan model key",
    )
    wan_api_token: SecretStr | None = Field(
        default=None,
        description="Optional bearer token for the private Wan inference endpoint",
    )
    wan_request_timeout_seconds: float = Field(default=30.0, gt=1, le=300)

    @computed_field
    @property
    def resolved_r2_endpoint(self) -> str | None:
        """Return the explicit R2 endpoint or derive the canonical Cloudflare endpoint."""
        if self.r2_endpoint and self.r2_endpoint.strip():
            return self.r2_endpoint.strip().rstrip("/")
        if self.r2_account_id and self.r2_account_id.strip():
            return f"https://{self.r2_account_id.strip()}.r2.cloudflarestorage.com"
        return None


def get_settings() -> WorkerSettings:
    """Return an initialized instance of WorkerSettings."""
    return WorkerSettings()
