"""Typed contracts for continuity-first chapter analysis orchestration."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, TypeVar

from pydantic import BaseModel, Field, model_validator

from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    VisualBeatShardResult,
)
from narrativex_worker.continuity.schema import (
    BeatContinuityState,
    ChapterContinuityPlan,
    ContinuityReport,
)
from narrativex_worker.providers.ports import ProviderBilling
from narrativex_worker.schema import ChapterAnalysisResult

ModelT = TypeVar("ModelT", bound=BaseModel)


@dataclass(frozen=True)
class AnalysisStepIdentity:
    """Stable logical identity used by durable subcall checkpoints."""

    step_key: str
    owned_source_range: dict[str, Any]
    continuity_inputs: dict[str, Any] = field(default_factory=dict)


class StructuredAnalysisAdapter(Protocol):
    async def generate(
        self,
        prompt: str,
        model: type[ModelT],
        *,
        identity: AnalysisStepIdentity | None = None,
    ) -> tuple[ModelT | None, ProviderBilling, str]: ...


class ChapterStructureWithContinuityResult(ChapterStructureResult):
    continuity_plan: ChapterContinuityPlan = Field(alias="continuityPlan")

    @model_validator(mode="after")
    def validate_scene_state_cardinality(self) -> ChapterStructureWithContinuityResult:
        if len(self.continuity_plan.scene_states) != len(self.scenes):
            raise ValueError("continuity scene state count must equal scene count")
        return self


class VisualBeatShardWithContinuityResult(VisualBeatShardResult):
    continuity_states: list[BeatContinuityState] = Field(alias="continuityStates")

    @model_validator(mode="after")
    def validate_state_cardinality(self) -> VisualBeatShardWithContinuityResult:
        if len(self.continuity_states) != len(self.visual_beats):
            raise ValueError("continuityStates must contain exactly one state per visual beat")
        return self


@dataclass(frozen=True)
class ChapterAnalysisPipelineResult:
    analysis: ChapterAnalysisResult
    continuity_plan: ChapterContinuityPlan
    continuity_states: dict[tuple[int, int], list[BeatContinuityState]]
    report: ContinuityReport
    billings: list[ProviderBilling]
    final_response_id: str
