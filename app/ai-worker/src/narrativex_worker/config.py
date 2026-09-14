"""Worker configuration for the local-first NarrativeX runtime."""

import ipaddress
from typing import Literal
from urllib.parse import urlparse

from pydantic import (
    AliasChoices,
    Field,
    SecretStr,
    computed_field,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

WORKER_ROLE_NAMES = {
    "analysis",
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

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        """Keep Python field names usable in code, but never accept them as env aliases.

        Pydantic normally treats ``populate_by_name=True`` as permission for environment sources
        to consume raw field names too. NarrativeX deliberately exposes only explicit environment
        aliases (for example ``AI_PROVIDER_MODE``), so removed names such as ``PROVIDER_MODE``
        cannot silently reactivate an old configuration contract.
        """
        del cls, settings_cls
        for source in (env_settings, dotenv_settings):
            source.config["populate_by_name"] = False
            source.config["validate_by_name"] = False
        return init_settings, env_settings, dotenv_settings, file_secret_settings

    worker_name: str = Field(default="narrativex-worker", description="Identifier of the worker")
    worker_env: str = Field(default="development", description="Environment stage")
    worker_roles: str = Field(
        default="analysis,narration,media-validation,image-generation",
        validation_alias=AliasChoices("WORKER_ROLES"),
        description="Comma-separated worker roles hosted by this process",
    )
    log_level: str = Field(default="INFO", description="Logging level")
    build_sha: str = Field(
        default="unknown",
        validation_alias=AliasChoices("BUILD_SHA", "NARRATIVEX_BUILD_SHA"),
        description="Immutable application/image revision reported in startup diagnostics",
    )
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

    provider_mode: Literal["disabled", "fake", "qwen"] = Field(
        default="disabled",
        validation_alias=AliasChoices("AI_PROVIDER_MODE"),
        description="Story-analysis provider adapter mode; production requires local Qwen",
    )
    qwen_base_url: str = Field(
        default="http://qwen:8000/v1",
        description="Private OpenAI-compatible endpoint serving the local Qwen model",
    )
    qwen_api_key: SecretStr | None = Field(
        default=None,
        description="Optional bearer token for a private local Qwen gateway",
    )
    qwen_model: str = "Qwen/Qwen3-8B-AWQ"
    qwen_timeout_seconds: float = Field(default=600.0, gt=1, le=3600)
    qwen_max_output_tokens: int = Field(default=16_384, ge=1024, le=32_768)
    qwen_analysis_shard_concurrency: int = Field(default=1, ge=1, le=2)
    qwen_analysis_shard_target_beats: int = Field(default=12, ge=4, le=20)
    qwen_analysis_shard_max_beats: int = Field(default=20, ge=8, le=24)
    qwen_analysis_repair_attempts: int = Field(default=1, ge=0, le=2)

    image_provider_mode: Literal["disabled", "fake", "realvisxl"] = Field(
        default="disabled", validation_alias=AliasChoices("IMAGE_PROVIDER_MODE")
    )
    image_batch_max_items: int = Field(default=1, ge=1, le=16)
    realvisxl_base_url: str = Field(
        default="http://host.docker.internal:8188",
        validation_alias=AliasChoices("REALVISXL_BASE_URL"),
        description="Private ComfyUI service origin used by the RealVisXL adapter",
    )
    realvisxl_timeout_seconds: float = Field(default=120.0, gt=1, le=1800)
    realvisxl_reference_workflow_path: str | None = Field(
        default=None,
        validation_alias=AliasChoices("REALVISXL_REFERENCE_WORKFLOW_PATH"),
        description="Optional ComfyUI API-format reference-conditioning workflow",
    )
    image_reconcile_max_attempts: int = Field(default=5, ge=1, le=100)
    image_unknown_max_age_seconds: int = Field(default=3600, ge=60, le=86_400)
    image_circuit_breaker_failure_threshold: int = Field(default=3, ge=1, le=100)
    image_circuit_breaker_open_seconds: int = Field(default=120, ge=1, le=86_400)
    image_max_output_bytes: int = Field(default=15_000_000, ge=1024, le=50_000_000)

    tts_provider_mode: Literal["disabled", "fake", "voicestudio"] = Field(
        default="disabled",
        validation_alias=AliasChoices("TTS_PROVIDER_MODE"),
    )
    tts_segment_batch_size: int = Field(default=8, ge=1, le=64)
    voicestudio_base_url: str = "http://voicestudio:3900"
    voicestudio_api_key: SecretStr | None = None
    voicestudio_model: str = "tts-1"
    voicestudio_voice_id: str = "voicestudio-default"
    voicestudio_voice_profile_id: str = "default"
    voicestudio_timeout_seconds: float = Field(default=600.0, gt=1, le=3600)
    voicestudio_inference_concurrency: int = Field(default=1, ge=1, le=2)

    gpu_transition_timeout_seconds: float = Field(
        default=600.0,
        gt=1,
        le=3600,
        validation_alias=AliasChoices("GPU_TRANSITION_TIMEOUT_SECONDS"),
        description="Maximum time to acquire GPU ownership or drain/unload a competing runtime",
    )
    gpu_comfyui_idle_poll_seconds: float = Field(
        default=0.5,
        gt=0,
        le=10,
        validation_alias=AliasChoices("GPU_COMFYUI_IDLE_POLL_SECONDS"),
        description="Polling interval while waiting for ComfyUI to become idle before unload",
    )

    project_media_local_dir: str = Field(
        default="/data/narrativex/project-media",
        validation_alias=AliasChoices("PROJECT_MEDIA_LOCAL_DIR"),
        description="Shared local filesystem root for generated and imported project media",
    )
    r2_account_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("R2_ACCOUNT_ID"),
        description="Cloudflare account ID used to derive the voice-reference R2 endpoint",
    )
    r2_access_key_id: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("R2_ACCESS_KEY_ID"),
        description="Cloudflare R2 API access key ID for voice-reference storage",
    )
    r2_secret_access_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("R2_SECRET_ACCESS_KEY"),
        description="Cloudflare R2 API secret access key for voice-reference storage",
    )
    r2_bucket: str = Field(
        default="narrativex-dev",
        min_length=1,
        validation_alias=AliasChoices("R2_BUCKET", "R2_BUCKET_NAME"),
        description="R2 bucket reserved for account-owned voice-reference assets",
    )
    r2_endpoint: str | None = Field(
        default=None,
        validation_alias=AliasChoices("R2_ENDPOINT", "R2_ENDPOINT_URL"),
        description="Optional voice-reference R2 endpoint override",
    )

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

    @field_validator("project_media_local_dir")
    @classmethod
    def validate_project_media_local_dir(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("PROJECT_MEDIA_LOCAL_DIR must not be blank")
        return normalized

    @field_validator("qwen_base_url")
    @classmethod
    def validate_qwen_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        if not normalized.startswith(("http://", "https://")):
            raise ValueError("QWEN_BASE_URL must use http:// or https://")
        if not normalized.endswith("/v1"):
            raise ValueError("QWEN_BASE_URL must end with /v1")
        return normalized

    @field_validator("qwen_model")
    @classmethod
    def validate_qwen_model(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("QWEN_MODEL must not be blank")
        return normalized

    @field_validator("realvisxl_base_url")
    @classmethod
    def validate_realvisxl_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        if not normalized.startswith(("http://", "https://")):
            raise ValueError("REALVISXL_BASE_URL must use http:// or https://")
        return normalized

    @field_validator("voicestudio_base_url")
    @classmethod
    def validate_voicestudio_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        if not normalized.startswith(("http://", "https://")):
            raise ValueError("VOICESTUDIO_BASE_URL must use http:// or https://")
        if normalized.endswith("/v1"):
            raise ValueError("VOICESTUDIO_BASE_URL must be the service origin, without /v1")
        return normalized

    @field_validator(
        "voicestudio_model",
        "voicestudio_voice_id",
        "voicestudio_voice_profile_id",
    )
    @classmethod
    def validate_non_blank_voicestudio_value(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("VoiceStudio model and voice identifiers must not be blank")
        return normalized

    def has_worker_role(self, role: str) -> bool:
        return role in {item.strip() for item in self.worker_roles.split(",") if item.strip()}

    @computed_field  # type: ignore[prop-decorator]
    @property
    def resolved_r2_endpoint(self) -> str | None:
        """Return the explicit voice-reference R2 endpoint or derive Cloudflare's endpoint."""
        if self.r2_endpoint and self.r2_endpoint.strip():
            return self.r2_endpoint.strip().rstrip("/")
        if self.r2_account_id and self.r2_account_id.strip():
            return f"https://{self.r2_account_id.strip()}.r2.cloudflarestorage.com"
        return None

    @model_validator(mode="after")
    def validate_runtime(self) -> "WorkerSettings":
        if self.worker_env.strip().lower() in {"production", "prod"}:
            self._validate_production_runtime()
        if self.qwen_analysis_shard_max_beats < self.qwen_analysis_shard_target_beats:
            raise ValueError("Qwen analysis shard max beats must be >= target beats")
        return self

    def require_voice_reference_r2(self) -> None:
        """Validate R2 settings only where a voice-reference R2 client is constructed."""
        missing: list[str] = []
        if not self.resolved_r2_endpoint:
            missing.append("R2_ACCOUNT_ID or R2_ENDPOINT")
        if self.r2_access_key_id is None or not self.r2_access_key_id.get_secret_value().strip():
            missing.append("R2_ACCESS_KEY_ID")
        if (
            self.r2_secret_access_key is None
            or not self.r2_secret_access_key.get_secret_value().strip()
        ):
            missing.append("R2_SECRET_ACCESS_KEY")
        if not self.r2_bucket.strip():
            missing.append("R2_BUCKET")
        if missing:
            raise ValueError("Missing voice-reference R2 settings: " + ", ".join(missing))

    def _validate_production_runtime(self) -> None:
        """Prevent production from selecting anything outside the local single-GPU stack."""
        errors: list[str] = []
        if self.has_worker_role("analysis") and self.provider_mode != "qwen":
            errors.append("AI_PROVIDER_MODE=qwen is required for production analysis")
        if (
            self.has_worker_role("analysis")
            and self.provider_mode == "qwen"
            and not _is_private_endpoint(self.qwen_base_url)
        ):
            errors.append("QWEN_BASE_URL must resolve to a loopback/private/local host")
        if self.has_worker_role("image-generation") and self.image_provider_mode != "realvisxl":
            errors.append(
                "IMAGE_PROVIDER_MODE=realvisxl is required for production image generation"
            )
        if (
            self.has_worker_role("image-generation")
            and self.image_provider_mode == "realvisxl"
            and not _is_private_endpoint(self.realvisxl_base_url)
        ):
            errors.append("REALVISXL_BASE_URL must resolve to a loopback/private/local host")
        if self.has_worker_role("image-generation") and self.image_batch_max_items != 1:
            errors.append("IMAGE_BATCH_MAX_ITEMS=1 is required for single-GPU RealVisXL")
        if self.has_worker_role("narration") and self.tts_provider_mode != "voicestudio":
            errors.append("TTS_PROVIDER_MODE=voicestudio is required for production narration")
        if (
            self.has_worker_role("narration")
            and self.tts_provider_mode == "voicestudio"
            and not _is_private_endpoint(self.voicestudio_base_url)
        ):
            errors.append("VOICESTUDIO_BASE_URL must resolve to a loopback/private/local host")
        if errors:
            raise ValueError("Invalid production worker configuration: " + "; ".join(errors))


def get_settings() -> WorkerSettings:
    """Return an initialized instance of WorkerSettings."""
    return WorkerSettings()


def _is_private_endpoint(url: str) -> bool:
    hostname = urlparse(url).hostname
    if hostname is None:
        return False
    normalized = hostname.lower().rstrip(".")
    if normalized in {"localhost", "host.docker.internal", "qwen", "voicestudio", "comfyui"}:
        return True
    if "." not in normalized or normalized.endswith((".local", ".internal")):
        return True
    try:
        address = ipaddress.ip_address(normalized)
    except ValueError:
        return False
    return address.is_private or address.is_loopback
