"""Compute Protocol v1 request and response models.

These are transport contracts, not the worker's domain model. Keeping them in a
dedicated package makes protocol evolution explicit and prevents provider SDK
types from becoming part of the application core.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class ProtocolModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda value: _camel_case(value), populate_by_name=True, extra="forbid"
    )


def _camel_case(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


Sha256 = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
ProtocolVersion = Literal["1.0"]


class TaskDescriptor(ProtocolModel):
    type: Literal["audio.synthesize", "audio.align", "image.generate", "media.validate"]
    schema_version: Literal["1.0"]


class ModelRef(ProtocolModel):
    executor: Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")]
    model: Annotated[str, Field(min_length=1, max_length=128)]
    revision: Annotated[str, Field(min_length=1, max_length=128)]


class TaskConstraints(ProtocolModel):
    deadline: datetime
    max_runtime_seconds: Annotated[int, Field(ge=1, le=86400)]


class ArtifactAccess(ProtocolModel):
    method: Literal["GET", "PUT"]
    url: HttpUrl
    expires_at: datetime
    headers: dict[str, str]


class ArtifactRef(ProtocolModel):
    artifact_id: UUID
    role: Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")]
    media_type: Annotated[str, Field(pattern=r"^[a-z0-9.+-]+/[a-z0-9.+-]+$")]
    size_bytes: Annotated[int, Field(ge=0)]
    sha256: Sha256
    access: ArtifactAccess


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


TaskInputs = AudioSynthesizeInputs | AudioAlignInputs | ImageGenerateInputs | MediaValidateInputs


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
    artifacts: Annotated[list[ArtifactRef], Field(max_length=32)]

    @model_validator(mode="after")
    def input_schema_matches_task_type(self) -> ComputeTask:
        expected = {
            "audio.synthesize": AudioSynthesizeInputs,
            "audio.align": AudioAlignInputs,
            "image.generate": ImageGenerateInputs,
            "media.validate": MediaValidateInputs,
        }[self.task.type]
        if not isinstance(self.inputs, expected):
            raise ValueError("inputs do not match task.type")
        return self


class ExecutionState(StrEnum):
    ACCEPTED = "ACCEPTED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"


class ErrorCategory(StrEnum):
    PERMANENT = "PERMANENT"
    TRANSIENT = "TRANSIENT"
    CAPACITY = "CAPACITY"
    CANCELED = "CANCELED"


class ComputeError(ProtocolModel):
    code: Annotated[str, Field(pattern=r"^[A-Z][A-Z0-9_]{0,63}$")]
    category: ErrorCategory
    message: Annotated[str, Field(min_length=1, max_length=500)]
    retry_after_seconds: Annotated[int, Field(ge=0, le=86400)] | None
    details: dict[str, str | int | float | bool | None]


class ExecutionMetrics(ProtocolModel):
    runtime_ms: Annotated[int, Field(ge=0)] | None = None
    gpu_time_ms: Annotated[int, Field(ge=0)] | None = None
    peak_vram_bytes: Annotated[int, Field(ge=0)] | None = None


class ComputeObservation(ProtocolModel):
    protocol_version: ProtocolVersion = "1.0"
    task_id: UUID
    attempt_id: UUID
    state: ExecutionState
    sequence: Annotated[int, Field(ge=0)]
    observed_at: datetime
    execution_handle: Annotated[str, Field(max_length=512)] | None = None
    progress: Annotated[float, Field(ge=0, le=1)] | None = None
    outputs: Annotated[list[ArtifactRef], Field(max_length=32)] = Field(default_factory=list)
    metrics: ExecutionMetrics = Field(default_factory=ExecutionMetrics)
    error: ComputeError | None = None

    @model_validator(mode="after")
    def terminal_error_is_consistent(self) -> ComputeObservation:
        if self.state == ExecutionState.FAILED and self.error is None:
            raise ValueError("FAILED observation requires error")
        if self.state == ExecutionState.SUCCEEDED and self.error is not None:
            raise ValueError("SUCCEEDED observation cannot contain error")
        return self


class ExecutorCapability(ProtocolModel):
    name: str
    task_types: list[str]
    models: list[ModelRef]
    ready: bool


class WorkerLimits(ProtocolModel):
    max_concurrent_tasks: Annotated[int, Field(ge=1)]
    max_request_bytes: Annotated[int, Field(ge=1)]
    max_artifact_bytes: Annotated[int, Field(ge=1)]


class WorkerCapabilities(ProtocolModel):
    protocol_versions: list[ProtocolVersion]
    worker_version: str
    executors: list[ExecutorCapability]
    limits: WorkerLimits
