"""Provider-neutral media planning contracts for long-form story video generation."""

from enum import StrEnum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProductionMode(StrEnum):
    """Transport vocabulary for the production policy already authorized by the backend."""

    IMAGE_MOTION = "IMAGE_MOTION"
    HYBRID_LOCAL_I2V = "HYBRID_LOCAL_I2V"


class MotionComplexity(StrEnum):
    SIMPLE = "SIMPLE"
    MEDIUM = "MEDIUM"
    COMPLEX = "COMPLEX"


class VisualAssetStrategy(StrEnum):
    REUSE_APPROVED = "REUSE_APPROVED"
    REFRAME_DERIVED = "REFRAME_DERIVED"
    EDIT_EXISTING = "EDIT_EXISTING"
    GENERATE_NEW = "GENERATE_NEW"


class MotionStrategy(StrEnum):
    """Execution decision supplied by the backend MediaPlan; the worker must not re-resolve it."""

    BASIC_IMAGE_MOTION = "BASIC_IMAGE_MOTION"
    IMAGE_TO_VIDEO = "IMAGE_TO_VIDEO"


class I2vResolution(StrEnum):
    P480 = "480p"
    P720 = "720p"


class VisualScenePlan(BaseModel):
    """A narration-timed visual unit; duration is adaptive, never a fixed domain constant."""

    model_config = ConfigDict(extra="forbid")

    visual_scene_id: str = Field(min_length=1, max_length=128)
    chapter_id: int = Field(gt=0)
    audio_start_ms: int = Field(ge=0)
    audio_end_ms: int = Field(gt=0)
    source_text_start: int = Field(ge=0)
    source_text_end: int = Field(ge=0)
    motion_complexity: MotionComplexity
    asset_strategy: VisualAssetStrategy
    motion_strategy: MotionStrategy
    source_asset_id: str | None = Field(default=None, max_length=256)
    planned_i2v_seconds: int = Field(default=0, ge=0, le=60)
    planned_i2v_resolution: I2vResolution | None = None
    motion_prompt: str = Field(default="", max_length=8000)

    @model_validator(mode="after")
    def validate_spans_and_motion(self) -> Self:
        if self.audio_end_ms <= self.audio_start_ms:
            raise ValueError("audio_end_ms must be greater than audio_start_ms")
        if self.source_text_end < self.source_text_start:
            raise ValueError("source_text_end must be greater than or equal to source_text_start")

        if (
            self.asset_strategy
            in {
                VisualAssetStrategy.REUSE_APPROVED,
                VisualAssetStrategy.REFRAME_DERIVED,
                VisualAssetStrategy.EDIT_EXISTING,
            }
            and not self.source_asset_id
        ):
            raise ValueError(f"{self.asset_strategy} requires source_asset_id")

        if self.motion_strategy is MotionStrategy.IMAGE_TO_VIDEO:
            if self.planned_i2v_seconds <= 0:
                raise ValueError("IMAGE_TO_VIDEO requires planned_i2v_seconds > 0")
            if self.planned_i2v_resolution is None:
                raise ValueError("IMAGE_TO_VIDEO requires planned_i2v_resolution")
        else:
            if self.planned_i2v_seconds != 0 or self.planned_i2v_resolution is not None:
                raise ValueError("BASIC_IMAGE_MOTION cannot reserve I2V seconds or resolution")

        return self
