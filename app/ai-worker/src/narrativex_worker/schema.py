"""Durable worker payloads shared with the backend contract."""

from enum import IntEnum, StrEnum
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

ENTITY_KEY_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$"


class ResourceClass(StrEnum):
    PROVIDER_INTERACTIVE = "PROVIDER_INTERACTIVE"
    PROVIDER_BATCH = "PROVIDER_BATCH"
    GPU_HEAVY = "GPU_HEAVY"
    CPU_RENDER = "CPU_RENDER"
    CPU_LIGHT = "CPU_LIGHT"
    BACKGROUND = "BACKGROUND"
    NOTIFICATION = "NOTIFICATION"
    FAST_CPU = "FAST_CPU"
    CPU_HEAVY = "CPU_HEAVY"
    MEDIA_IO = "MEDIA_IO"


class JobType(StrEnum):
    CHAPTER_ANALYZE = "CHAPTER_ANALYZE"
    NARRATION_GENERATE = "NARRATION_GENERATE"
    CHAPTER_GENERATE = "CHAPTER_GENERATE"


class ImageAspectRatio(StrEnum):
    RATIO_16_9 = "16:9"
    RATIO_9_16 = "9:16"
    RATIO_1_1 = "1:1"
    RATIO_4_3 = "4:3"
    RATIO_3_4 = "3:4"


class ImageQualityTier(StrEnum):
    """Legacy provider/storage boundary; active product settings no longer expose this choice."""

    DRAFT = "DRAFT"
    STANDARD = "STANDARD"
    HIGH = "HIGH"


class ShotSize(StrEnum):
    ESTABLISHING = "ESTABLISHING"
    WIDE = "WIDE"
    MEDIUM = "MEDIUM"
    MEDIUM_CLOSE_UP = "MEDIUM_CLOSE_UP"
    CLOSE_UP = "CLOSE_UP"
    EXTREME_CLOSE_UP = "EXTREME_CLOSE_UP"


class CameraAngle(StrEnum):
    EYE_LEVEL = "EYE_LEVEL"
    LOW = "LOW"
    HIGH = "HIGH"
    OVERHEAD = "OVERHEAD"
    OVER_SHOULDER = "OVER_SHOULDER"
    POV = "POV"


class LensMm(IntEnum):
    MM_24 = 24
    MM_35 = 35
    MM_50 = 50
    MM_85 = 85


class ActionPhase(StrEnum):
    BEFORE = "BEFORE"
    IMPACT = "IMPACT"
    AFTER = "AFTER"
    REACTION = "REACTION"


class CameraMovement(StrEnum):
    NONE = "NONE"
    PUSH_IN = "PUSH_IN"
    PULL_OUT = "PULL_OUT"
    PAN = "PAN"
    TILT = "TILT"
    PARALLAX = "PARALLAX"


class MovementDirection(StrEnum):
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    UP = "UP"
    DOWN = "DOWN"


class MovementIntensity(StrEnum):
    SUBTLE = "SUBTLE"
    MODERATE = "MODERATE"


class VisualBeatCharacterRole(StrEnum):
    PRIMARY = "PRIMARY"
    SECONDARY = "SECONDARY"
    BACKGROUND = "BACKGROUND"


class ModerationDecision(StrEnum):
    SAFE = "SAFE"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"


class ImageGenerationSettings(BaseModel):
    """Provider-neutral image settings; image generation always uses the best quality path."""

    model_config = ConfigDict(extra="forbid")

    aspect_ratio: ImageAspectRatio = ImageAspectRatio.RATIO_16_9
    source: str = Field(default="PROJECT_DEFAULT", pattern=r"^(PROJECT_DEFAULT|BEAT_OVERRIDE)$")


class VisualDirectionV3(BaseModel):
    """Structured, provider-neutral direction for one storyboard frame and its subtle motion."""

    model_config = ConfigDict(extra="forbid")

    shot_size: ShotSize
    camera_angle: CameraAngle
    lens_mm: LensMm
    focus_target: str = Field(min_length=1, max_length=1000)
    action_phase: ActionPhase
    subject_placement: str = Field(min_length=1, max_length=1000)
    foreground: str | None = Field(default=None, min_length=1, max_length=1000)
    background: str = Field(min_length=1, max_length=2000)
    motivated_light: str = Field(min_length=1, max_length=1000)
    palette: str = Field(min_length=1, max_length=1000)
    camera_movement: CameraMovement = CameraMovement.NONE
    movement_direction: MovementDirection | None = None
    movement_intensity: MovementIntensity = MovementIntensity.SUBTLE
    crop_safe_area: str = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def validate_movement_direction(self) -> Self:
        if self.camera_movement == CameraMovement.PAN and self.movement_direction not in {
            MovementDirection.LEFT,
            MovementDirection.RIGHT,
        }:
            raise ValueError("PAN requires LEFT or RIGHT movement_direction")
        if self.camera_movement == CameraMovement.TILT and self.movement_direction not in {
            MovementDirection.UP,
            MovementDirection.DOWN,
        }:
            raise ValueError("TILT requires UP or DOWN movement_direction")
        return self


class CharacterAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(pattern=ENTITY_KEY_PATTERN)
    name: str = Field(min_length=1, max_length=160)
    aliases: list[str] = Field(default_factory=list)
    description: str = Field(default="", max_length=4000)
    role: str = Field(default="SUPPORTING", min_length=1, max_length=64)
    importance: int = Field(default=0, ge=0)
    groups: list[str] = Field(default_factory=list, max_length=20)
    bible: str = Field(default="", max_length=8000)
    visual_prompt: str = Field(default="", max_length=8000)
    age_state: str = Field(default="", max_length=2000)
    hairstyle: str = Field(default="", max_length=2000)
    injury: str = Field(default="", max_length=2000)
    wardrobe_context: str = Field(default="", max_length=4000)
    appearance_prompt: str = Field(default="", max_length=8000)


class LocationAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(pattern=ENTITY_KEY_PATTERN)
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=4000)
    visual_prompt: str = Field(default="", max_length=8000)


class VisualBeatCharacterRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    character_key: str = Field(pattern=ENTITY_KEY_PATTERN)
    role: VisualBeatCharacterRole = VisualBeatCharacterRole.SECONDARY


class VisualBeatAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    visual_intent: str = Field(min_length=1, max_length=8000)
    source_anchor: str = Field(min_length=1, max_length=2000)
    visual_direction: VisualDirectionV3
    characters: list[VisualBeatCharacterRef] = Field(default_factory=list)


class SceneCharacterRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    character_key: str = Field(pattern=ENTITY_KEY_PATTERN)


class SceneAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    narration: str = Field(default="", max_length=50_000)
    characters: list[SceneCharacterRef] = Field(default_factory=list)
    location_key: str | None = Field(default=None, pattern=ENTITY_KEY_PATTERN)
    visual_beats: list[VisualBeatAnalysis] = Field(min_length=1)


class ChapterAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    characters: list[CharacterAnalysis] = Field(default_factory=list)
    locations: list[LocationAnalysis] = Field(default_factory=list)
    scenes: list[SceneAnalysis] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_scene_references(self) -> Self:
        character_keys = [character.key for character in self.characters]
        location_keys = [location.key for location in self.locations]
        if len(character_keys) != len(set(character_keys)):
            raise ValueError("character keys must be unique")
        if len(location_keys) != len(set(location_keys)):
            raise ValueError("location keys must be unique")

        known_character_keys = set(character_keys)
        known_location_keys = set(location_keys)
        for scene_index, scene in enumerate(self.scenes):
            scene_character_keys = [ref.character_key for ref in scene.characters]
            if len(scene_character_keys) != len(set(scene_character_keys)):
                raise ValueError(f"scene {scene_index} contains duplicate character references")
            for character_key in scene_character_keys:
                if character_key not in known_character_keys:
                    raise ValueError(
                        f"scene {scene_index} references unknown character_key {character_key!r}"
                    )
            if scene.location_key is not None and scene.location_key not in known_location_keys:
                raise ValueError(
                    f"scene {scene_index} references unknown location_key {scene.location_key!r}"
                )

            scene_character_set = set(scene_character_keys)
            for beat_index, beat in enumerate(scene.visual_beats):
                beat_character_keys = [ref.character_key for ref in beat.characters]
                if len(beat_character_keys) != len(set(beat_character_keys)):
                    raise ValueError(
                        f"scene {scene_index} visual beat {beat_index} contains duplicate "
                        "character references"
                    )
                for character_key in beat_character_keys:
                    if character_key not in known_character_keys:
                        raise ValueError(
                            f"scene {scene_index} visual beat {beat_index} references unknown "
                            f"character_key {character_key!r}"
                        )
                    if character_key not in scene_character_set:
                        raise ValueError(
                            f"scene {scene_index} visual beat {beat_index} references "
                            "character_key "
                            f"{character_key!r} that is not present in the scene"
                        )
        return self


class ChapterAnalysisRequest(BaseModel):
    """A persisted Chapter snapshot. Source content is data, never instruction/tool authority."""

    project_id: UUID
    story_version_id: UUID
    chapter_id: UUID
    chapter_row_version: int = Field(ge=0)
    source_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    source_text: str = Field(min_length=1, max_length=500_000)
    source_language: str = Field(default="vi-VN", min_length=2, max_length=16)
    visual_generation_mode: str = Field(default="IMAGE", pattern=r"^(IMAGE|VIDEO)$")
    image_provider: str | None = Field(default="API", pattern=r"^(GEMINI_WEB|API)$")
    safety_policy_version: str = Field(default="safety-v1.8", min_length=1, max_length=64)
    preferred_locale: str = Field(default="vi-VN", min_length=2, max_length=16)

    @model_validator(mode="after")
    def validate_visual_preferences(self) -> Self:
        if self.visual_generation_mode == "IMAGE" and self.image_provider is None:
            raise ValueError("image_provider is required for IMAGE analysis")
        if self.visual_generation_mode == "VIDEO" and self.image_provider is not None:
            raise ValueError("image_provider must be null for VIDEO analysis")
        return self


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
