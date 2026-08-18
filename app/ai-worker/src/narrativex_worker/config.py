"""Worker configuration module.

Production Vertex authentication comes from ADC/workload identity at runtime. Provider credentials
are never copied into durable job payloads.
"""

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    """NarrativeX Worker settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
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
    provider_mode: Literal["disabled", "vertex"] = Field(
        default="disabled", description="Provider adapter mode; disabled is safe by default"
    )
    vertex_project_id: str | None = Field(
        default=None, description="Google Cloud project for Vertex AI"
    )
    vertex_location: str = Field(default="us-central1", description="Vertex AI region")
    vertex_model: str = Field(default="gemini-2.5-flash", description="Configured Gemini model key")
    vertex_timeout_seconds: float = Field(default=120.0, gt=1, le=600)


def get_settings() -> WorkerSettings:
    """Return an initialized instance of WorkerSettings."""
    return WorkerSettings()
