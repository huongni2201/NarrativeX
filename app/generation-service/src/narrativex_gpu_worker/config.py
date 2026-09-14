from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GPU_WORKER_", extra="ignore")

    host: str = "127.0.0.1"
    port: int = Field(default=8010, ge=1, le=65535)
    machine_token: SecretStr
    journal_file: Path = Path(".runtime/gpu-worker.sqlite3")
    max_concurrent_tasks: int = Field(default=1, ge=1, le=128)
    max_request_bytes: int = Field(default=1_048_576, ge=1024)
    max_artifact_bytes: int = Field(default=2_147_483_648, ge=1)
    log_level: str = "INFO"


@lru_cache
def get_settings() -> WorkerSettings:
    return WorkerSettings()  # type: ignore[call-arg]
