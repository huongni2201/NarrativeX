"""Worker configuration module.

Provider credentials are intentionally not represented here. Production Vertex
authentication is expected to come from ADC/workload identity at runtime.
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
    provider_mode: Literal["disabled", "vertex"] = Field(
        default="disabled", description="Provider adapter mode; disabled is safe by default"
    )
    vertex_project_id: str | None = Field(
        default=None, description="Google Cloud project for Vertex AI"
    )
    vertex_location: str = Field(default="us-central1", description="Vertex AI region")
    vertex_model: str = Field(default="gemini-2.5-flash", description="Configured Gemini model key")


def get_settings() -> WorkerSettings:
    """Return an initialized instance of WorkerSettings."""
    return WorkerSettings()
