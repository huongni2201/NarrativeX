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


class CharacterAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    aliases: list[str] = Field(default_factory=list)
    description: str = Field(default="", max_length=4000)


class LocationAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)


class VisualBeatAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    visual_intent: str = Field(min_length=1, max_length=8000)


class SceneAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    narration: str = Field(default="", max_length=50_000)
    characters: list[str] = Field(default_factory=list)
    location: str | None = Field(default=None, max_length=200)
    visual_beats: list[VisualBeatAnalysis] = Field(min_length=1)


class ChapterAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    characters: list[CharacterAnalysis] = Field(default_factory=list)
    locations: list[LocationAnalysis] = Field(default_factory=list)
    scenes: list[SceneAnalysis] = Field(min_length=1)


class ChapterAnalysisRequest(BaseModel):
    """A persisted Chapter snapshot. Source content is data, never instruction/tool authority."""

    model_config = ConfigDict(extra="forbid")

    project_id: int = Field(gt=0)
    story_version_id: int = Field(gt=0)
    chapter_id: int = Field(gt=0)
    chapter_row_version: int = Field(ge=0)
    source_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    source_text: str = Field(min_length=1, max_length=500_000)
    source_language: str = Field(default="vi-VN", min_length=2, max_length=16)
    safety_policy_version: str = Field(default="safety-v1.8", min_length=1, max_length=64)
    preferred_locale: str = Field(default="vi-VN", min_length=2, max_length=16)

    @field_validator("source_text")
    @classmethod
    def validate_estimated_tokens(cls, value: str) -> str:
        estimated_tokens = max(1, (len(value) + 3) // 4)
        if estimated_tokens > 120_000:
            raise ValueError("source_text exceeds the 120000 estimated token limit")
        return value


class GenerationJobEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str = Field(min_length=1, max_length=128)
    job_type: JobType
    resource_class: ResourceClass
    payload: ChapterAnalysisRequest | dict[str, object]


class ProviderOperationStatus(StrEnum):
    RESERVED = "RESERVED"
    SUBMITTED = "SUBMITTED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"
