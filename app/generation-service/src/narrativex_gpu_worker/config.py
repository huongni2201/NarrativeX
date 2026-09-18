from __future__ import annotations

from functools import lru_cache
from importlib.util import find_spec
from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="GENERATION_SERVICE_",
        extra="ignore",
        populate_by_name=True,
    )

    host: str = Field(
        default="127.0.0.1",
        validation_alias="GENERATION_SERVICE_HOST",
    )
    port: int = Field(
        default=8010,
        ge=1,
        le=65535,
        validation_alias="GENERATION_SERVICE_PORT",
    )
    machine_token: SecretStr = Field(
        validation_alias="GENERATION_SERVICE_MACHINE_TOKEN"
    )
    journal_file: Path = Field(
        default=Path(".runtime/generation-service.sqlite3"),
        validation_alias="GENERATION_SERVICE_JOURNAL_FILE",
    )
    max_concurrent_tasks: int = Field(
        default=1,
        ge=1,
        le=128,
        validation_alias=AliasChoices(
            "GENERATION_MAX_CONCURRENCY",
            "GENERATION_SERVICE_MAX_CONCURRENCY",
        ),
    )
    max_request_bytes: int = Field(
        default=1_048_576,
        ge=1024,
        validation_alias="GENERATION_SERVICE_MAX_REQUEST_BYTES",
    )
    max_artifact_bytes: int = Field(
        default=2_147_483_648,
        ge=1,
        validation_alias="GENERATION_SERVICE_MAX_ARTIFACT_BYTES",
    )
    log_level: str = "INFO"

    comfyui_base_url: str = Field(
        default="http://127.0.0.1:8188",
        validation_alias="GENERATION_SERVICE_COMFYUI_BASE_URL",
    )
    comfyui_timeout_seconds: float = Field(
        default=120.0,
        gt=0,
        validation_alias="GENERATION_SERVICE_COMFYUI_TIMEOUT_SECONDS",
    )
    vieneu_base_url: str = Field(
        default="http://127.0.0.1:8008",
        validation_alias="GENERATION_SERVICE_VIENEU_BASE_URL",
    )
    vieneu_api_key: SecretStr = Field(
        default=SecretStr(""),
        validation_alias="GENERATION_SERVICE_VIENEU_API_KEY",
    )
    vieneu_timeout_seconds: float = Field(
        default=300.0,
        gt=0,
        validation_alias="GENERATION_SERVICE_VIENEU_TIMEOUT_SECONDS",
    )
    whisperx_device: str = Field(
        default="cuda",
        validation_alias="GENERATION_SERVICE_WHISPERX_DEVICE",
    )
    whisperx_align_model_name: str | None = Field(
        default=None,
        validation_alias="GENERATION_SERVICE_WHISPERX_ALIGN_MODEL_NAME",
    )
    residency_enabled: bool = Field(
        default=True,
        validation_alias="GENERATION_SERVICE_RESIDENCY_ENABLED",
    )
    residency_transition_timeout_seconds: float = Field(
        default=30.0,
        gt=0,
        validation_alias="GENERATION_SERVICE_RESIDENCY_TIMEOUT_SECONDS",
    )

    @property
    def whisperx_available(self) -> bool:
        try:
            return find_spec("whisperx") is not None
        except (ImportError, ModuleNotFoundError):
            return False


@lru_cache
def get_settings() -> WorkerSettings:
    return WorkerSettings()  # type: ignore[call-arg]
