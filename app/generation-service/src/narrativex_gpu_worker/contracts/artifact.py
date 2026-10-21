"""Artifact models and access capabilities for the Compute Protocol v1."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


def _camel_case(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ProtocolModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda value: _camel_case(value), populate_by_name=True, extra="forbid"
    )


Sha256 = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class ArtifactReadAccess(ProtocolModel):
    method: Literal["GET"]
    url: HttpUrl
    expires_at: datetime
    headers: dict[str, str] = Field(default_factory=dict)


class ArtifactWriteAccess(ProtocolModel):
    method: Literal["PUT"]
    url: HttpUrl
    expires_at: datetime
    headers: dict[str, str] = Field(default_factory=dict)


class InputArtifactRef(ProtocolModel):
    artifact_id: UUID
    role: Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")]
    media_type: Annotated[str, Field(pattern=r"^[a-z0-9.+-]+/[a-z0-9.+-]+$")]
    size_bytes: Annotated[int, Field(ge=0)]
    sha256: Sha256
    access: ArtifactReadAccess


class OutputArtifactTarget(ProtocolModel):
    artifact_id: UUID
    role: Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")]
    media_type: Annotated[str, Field(pattern=r"^[a-z0-9.+-]+/[a-z0-9.+-]+$")]
    access: ArtifactWriteAccess


Measure = Annotated[float, Field(allow_inf_nan=False)]
DurationMs = Annotated[int, Field(ge=0)]


class VideoQualityMetrics(ProtocolModel):
    """Raw take measurements. Thresholds and verdicts belong to the backend, not the worker."""

    status: Literal["MEASURED", "UNAVAILABLE"]
    scorer_version: Annotated[str, Field(min_length=1, max_length=64)]
    reason: Annotated[str, Field(max_length=256)] | None = None
    freeze_head_ms: DurationMs | None = None
    freeze_total_ms: DurationMs | None = None
    motion_mean: Measure | None = None
    scene_cut_count: Annotated[int, Field(ge=0)] | None = None
    flicker_stddev: Measure | None = None
    black_total_ms: DurationMs | None = None
    silence_total_ms: DurationMs | None = None
    integrated_lufs: Measure | None = None
    peak_dbfs: Measure | None = None
    mean_y: Measure | None = None
    mean_u: Measure | None = None
    mean_v: Measure | None = None


class VideoTechnicalMetadata(ProtocolModel):
    duration_ms: Annotated[int, Field(gt=0)]
    width: Annotated[int, Field(gt=0)]
    height: Annotated[int, Field(gt=0)]
    fps: Annotated[float, Field(gt=0, allow_inf_nan=False)]
    has_audio: bool
    decode_passed: bool
    quality_metrics: VideoQualityMetrics | None = None


class ProducedArtifact(ProtocolModel):
    artifact_id: UUID
    role: Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")]
    media_type: Annotated[str, Field(pattern=r"^[a-z0-9.+-]+/[a-z0-9.+-]+$")]
    size_bytes: Annotated[int, Field(ge=0)]
    sha256: Sha256
    technical_metadata: VideoTechnicalMetadata | None = None


class TaskArtifacts(ProtocolModel):
    inputs: Annotated[list[InputArtifactRef], Field(max_length=32)] = Field(default_factory=list)
    outputs: Annotated[list[OutputArtifactTarget], Field(max_length=32)] = Field(
        default_factory=list
    )


__all__ = [
    "ArtifactReadAccess",
    "ArtifactWriteAccess",
    "InputArtifactRef",
    "OutputArtifactTarget",
    "ProducedArtifact",
    "ProtocolModel",
    "Sha256",
    "TaskArtifacts",
    "VideoQualityMetrics",
    "VideoTechnicalMetadata",
]
