"""Durable worker payloads shared with the backend contract."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ResourceClass(StrEnum):
    PROVIDER_INTERACTIVE = "PROVIDER_INTERACTIVE"
    PROVIDER_BATCH = "PROVIDER_BATCH"
    GPU_HEAVY = "GPU_HEAVY"
    CPU_RENDER = "CPU_RENDER"
    CPU_LIGHT = "CPU_LIGHT"
    BACKGROUND = "BACKGROUND"
    NOTIFICATION = "NOTIFICATION"


class JobType(StrEnum):
    STORY_ANALYZE = "STORY_ANALYZE"
    CHAPTER_ANALYZE = "CHAPTER_ANALYZE"
    CHAPTER_GENERATE = "CHAPTER_GENERATE"
    CHAPTER_RENDER = "CHAPTER_RENDER"
    PROJECT_CONTINUE = "PROJECT_CONTINUE"
    VISUAL_BEAT_PLAN = "VISUAL_BEAT_PLAN"
    SHOT_IMAGE_GENERATE = "SHOT_IMAGE_GENERATE"
    RENDER_PROJECT = "RENDER_PROJECT"
    RENDER_SHORT = "RENDER_SHORT"


class ImageAspectRatio(StrEnum):
    RATIO_16_9 = "16:9"
    RATIO_9_16 = "9:16"
    RATIO_1_1 = "1:1"
    RATIO_4_3 = "4:3"
    RATIO_3_4 = "3:4"


class ImageQualityTier(StrEnum):
    DRAFT = "DRAFT"
    STANDARD = "STANDARD"
    HIGH = "HIGH"


class ModerationDecision(StrEnum):
    SAFE = "SAFE"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"


class ImageGenerationSettings(BaseModel):
    """Provider-neutral image settings; adapters resolve vendor dimensions later."""

    model_config = ConfigDict(extra="forbid")

    aspect_ratio: ImageAspectRatio = ImageAspectRatio.RATIO_16_9
    quality_tier: ImageQualityTier = ImageQualityTier.STANDARD
    source: str = Field(default="PROJECT_DEFAULT", pattern=r"^(PROJECT_DEFAULT|BEAT_OVERRIDE)$")


class StoryAnalysisRequest(BaseModel):
    """Story content is data, never an instruction or tool authority."""

    model_config = ConfigDict(extra="forbid")

    story_version_id: str = Field(min_length=1, max_length=128)
    story_text: str = Field(min_length=1, max_length=500_000)
    source_language: str = Field(default="vi-VN", min_length=2, max_length=16)
    rights_attested: bool
    rights_policy_version: str = Field(default="rights-v1.7", min_length=1, max_length=64)
    rights_basis: str = Field(
        default="USER_ATTESTED_RIGHTS_OR_LICENSE", min_length=1, max_length=64
    )
    safety_policy_version: str = Field(default="safety-v1.7", min_length=1, max_length=64)
    preferred_locale: str = Field(default="vi-VN", min_length=2, max_length=16)

    @field_validator("story_text")
    @classmethod
    def validate_estimated_tokens(cls, value: str) -> str:
        estimated_tokens = max(1, (len(value) + 3) // 4)
        if estimated_tokens > 120_000:
            raise ValueError("story_text exceeds the 120000 estimated token limit")
        return value


class GenerationJobEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str = Field(min_length=1, max_length=128)
    job_type: JobType
    resource_class: ResourceClass
    payload: StoryAnalysisRequest | dict[str, object]


class ProviderOperationStatus(StrEnum):
    RESERVED = "RESERVED"
    SUBMITTED = "SUBMITTED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"
