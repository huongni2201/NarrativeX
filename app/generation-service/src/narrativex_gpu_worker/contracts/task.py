"""Compute Protocol v1 task descriptor and input schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import Field, model_validator

from .artifact import ProtocolModel, Sha256, TaskArtifacts

ProtocolVersion = Literal["1.0"]


class TaskDescriptor(ProtocolModel):
    type: Literal[
        "audio.synthesize",
        "audio.align",
        "image.generate",
        "media.validate",
        "text.generate",
        "video.generate",
    ]
    schema_version: Literal["1.0"]


class ModelRef(ProtocolModel):
    executor: Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")]
    model: Annotated[str, Field(min_length=1, max_length=128)]
    revision: Annotated[str, Field(min_length=1, max_length=128)]


class TaskConstraints(ProtocolModel):
    deadline: datetime
    max_runtime_seconds: Annotated[int, Field(ge=1, le=86400)]


class VoiceSelection(ProtocolModel):
    kind: Literal["catalog", "artifact"]
    value: Annotated[str, Field(min_length=1, max_length=200)]


class AudioFormat(ProtocolModel):
    container: Literal["wav"]
    sample_rate_hz: Literal[16000, 24000, 44100, 48000]
    channels: Literal[1, 2]


class AudioSynthesizeInputs(ProtocolModel):
    script: Annotated[str, Field(min_length=1, max_length=100000)]
    voice: VoiceSelection
    format: AudioFormat


class AudioAlignInputs(ProtocolModel):
    script: Annotated[str, Field(min_length=1, max_length=100000)]
    language: Annotated[str, Field(pattern=r"^[a-z]{2,3}(-[A-Z]{2})?$")]
    audio_artifact_role: Literal["source-audio"]


class ImageGenerateInputs(ProtocolModel):
    prompt: Annotated[str, Field(min_length=1, max_length=20000)]
    negative_prompt: Annotated[str, Field(max_length=10000)]
    width: Annotated[int, Field(ge=64, le=8192)]
    height: Annotated[int, Field(ge=64, le=8192)]
    seed: Annotated[int, Field(ge=0)]


class MediaValidateInputs(ProtocolModel):
    artifact_role: Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")]
    allowed_media_types: Annotated[list[str], Field(min_length=1, max_length=16)]
    decode: bool


class TextGenerateInputs(ProtocolModel):
    prompt: Annotated[str, Field(min_length=1, max_length=500000)]
    system_prompt: Annotated[str | None, Field(max_length=50000)] = None
    temperature: Annotated[float, Field(ge=0.0, le=2.0)] = 0.2
    top_p: Annotated[float, Field(ge=0.0, le=1.0)] = 0.8
    max_tokens: Annotated[int, Field(ge=1, le=65536)] = 16384
    response_format: Literal["text", "json_object"] = "text"


class VideoReferenceAsset(ProtocolModel):
    asset_id: UUID
    reference_type: str
    weight: float = 1.0


class VideoVoiceReference(ProtocolModel):
    asset_id: UUID | None = None
    scope: Literal["PROJECT", "GLOBAL_LOCAL"] | None = None
    language: str | None = None
    accent: str | None = None
    voice_description: str | None = None
    delivery_baseline: str | None = None


class VideoDialogueLine(ProtocolModel):
    speaker: str | None = None
    text: str
    start_offset_ms: int | None = None
    end_offset_ms: int | None = None


class VideoCameraIntent(ProtocolModel):
    framing: str | None = None
    movement: str | None = None
    angle: str | None = None
    speed: str | None = None


class VideoMotionIntent(ProtocolModel):
    subject_motion: str | None = None
    speed: str | None = None
    dynamics: str | None = None


class VideoContinuity(ProtocolModel):
    incoming_shot_id: UUID | None = None
    outgoing_shot_id: UUID | None = None


class VideoGenerateInputs(ProtocolModel):
    prompt: Annotated[str, Field(min_length=1, max_length=20000)]
    negative_prompt: Annotated[str, Field(max_length=10000)]
    width: Annotated[int, Field(ge=64, le=8192)]
    height: Annotated[int, Field(ge=64, le=8192)]
    fps: Annotated[int, Field(ge=1, le=120)]
    duration_ms: Annotated[int, Field(ge=100, le=60000)]
    generation_mode: Literal[
        "TEXT_TO_VIDEO",
        "IMAGE_TO_VIDEO",
        "FIRST_LAST_FRAME",
        "MULTI_KEYFRAME",
        "VIDEO_EXTEND",
        "VIDEO_RETAKE",
    ]
    seed: Annotated[int, Field(ge=0)]
    reference_assets: list[VideoReferenceAsset] = Field(default_factory=list)
    reference_asset_ids: list[UUID] = Field(default_factory=list)
    voice_reference: VideoVoiceReference | None = None
    dialogue: list[VideoDialogueLine] = Field(default_factory=list)
    camera_intent: VideoCameraIntent | None = None
    motion_intent: VideoMotionIntent | None = None
    continuity: VideoContinuity | None = None
    provider_options: dict[str, Any] = Field(default_factory=dict)
    motion_bucket_id: Annotated[int | None, Field(ge=1, le=255)] = None


TaskInputs = (
    AudioSynthesizeInputs
    | AudioAlignInputs
    | ImageGenerateInputs
    | MediaValidateInputs
    | TextGenerateInputs
    | VideoGenerateInputs
)


class ComputeTask(ProtocolModel):
    protocol_version: ProtocolVersion
    task_id: UUID
    attempt_id: UUID
    idempotency_key: Annotated[
        str, Field(min_length=1, max_length=200, pattern=r"^[A-Za-z0-9:._-]+$")
    ]
    request_fingerprint: Sha256
    task: TaskDescriptor
    model: ModelRef
    constraints: TaskConstraints
    inputs: TaskInputs
    artifacts: TaskArtifacts = Field(default_factory=TaskArtifacts)

    @model_validator(mode="after")
    def input_schema_matches_task_type(self) -> ComputeTask:
        expected = {
            "audio.synthesize": AudioSynthesizeInputs,
            "audio.align": AudioAlignInputs,
            "image.generate": ImageGenerateInputs,
            "media.validate": MediaValidateInputs,
            "text.generate": TextGenerateInputs,
            "video.generate": VideoGenerateInputs,
        }[self.task.type]
        if not isinstance(self.inputs, expected):
            raise ValueError("inputs do not match task.type")
        return self


__all__ = [
    "AudioAlignInputs",
    "AudioFormat",
    "AudioSynthesizeInputs",
    "ComputeTask",
    "ImageGenerateInputs",
    "MediaValidateInputs",
    "ModelRef",
    "ProtocolVersion",
    "TaskConstraints",
    "TaskDescriptor",
    "TaskInputs",
    "TextGenerateInputs",
    "VideoCameraIntent",
    "VideoContinuity",
    "VideoDialogueLine",
    "VideoGenerateInputs",
    "VideoMotionIntent",
    "VideoReferenceAsset",
    "VideoVoiceReference",
    "VoiceSelection",
]
