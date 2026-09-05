"""Continuity-first chapter analysis orchestration independent from a concrete provider adapter."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Protocol, TypeVar

from pydantic import BaseModel, Field, model_validator

from narrativex_worker.chapter_analysis_prompts import (
    build_chapter_structure_prompt,
    build_visual_beat_shard_prompt,
)
from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    VisualBeatShard,
    VisualBeatShardResult,
    merge_shard_results,
    plan_visual_beat_shards,
    validate_visual_beat_shard,
)
from narrativex_worker.continuity.context import build_shard_continuity_contexts
from narrativex_worker.continuity.planner import validate_plan_source
from narrativex_worker.continuity.schema import (
    BeatContinuityState,
    ChapterContinuityPlan,
    ContinuityIssue,
    ContinuityIssueOrigin,
    ContinuityIssueSeverity,
    ContinuityReport,
    ContinuityReportStatus,
)
from narrativex_worker.providers.ports import ProviderBilling
from narrativex_worker.schema import ChapterAnalysisRequest, ChapterAnalysisResult


ModelT = TypeVar("ModelT", bound=BaseModel)


class StructuredAnalysisAdapter(Protocol):
    async def generate(
        self, prompt: str, model: type[ModelT]
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


async def run_chapter_analysis_pipeline(
    *,
    request: ChapterAnalysisRequest,
    adapter: StructuredAnalysisAdapter,
    target_beats: int,
    max_beats: int,
    repair_attempts: int,
    planning_duration_ms: int | None = None,
) -> ChapterAnalysisPipelineResult:
    structure, structure_billings, response_id = await _generate_structure(
        request=request,
        adapter=adapter,
        repair_attempts=repair_attempts,
    )
    validate_plan_source(structure.continuity_plan, request.source_text)
    shards = plan_visual_beat_shards(
        request.source_text,
        structure,
        target_beats=target_beats,
        max_beats=max_beats,
        planning_duration_ms=planning_duration_ms,
    )
    contexts = build_shard_continuity_contexts(
        source_text=request.source_text,
        structure=structure,
        plan=structure.continuity_plan,
        shards=shards,
    )

    async def generate_shard(
        shard: VisualBeatShard,
    ) -> tuple[VisualBeatShard, VisualBeatShardWithContinuityResult, list[ProviderBilling], str]:
        reason: str | None = None
        billings: list[ProviderBilling] = []
        shard_response_id = response_id
        for attempt in range(repair_attempts + 1):
            result, billing, shard_response_id = await adapter.generate(
                build_visual_beat_shard_prompt(
                    request,
                    structure,
                    shard,
                    continuity_context=contexts[(shard.scene_index, shard.shard_index)],
                    repair_reason=reason if attempt > 0 else None,
                ),
                VisualBeatShardWithContinuityResult,
            )
            billings.append(billing)
            reason = _shard_error(structure, shard, result)
            if reason is None and result is not None:
                return shard, result, billings, shard_response_id
        raise ValueError(
            f"continuity shard scene={shard.scene_index} shard={shard.shard_index} "
            f"rejected after bounded repair: {reason or 'invalid structured output'}"
        )

    tasks = [asyncio.create_task(generate_shard(shard)) for shard in shards]
    try:
        generated = await asyncio.gather(*tasks)
    except BaseException:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        raise

    shard_results: dict[tuple[int, int], VisualBeatShardResult] = {}
    continuity_states: dict[tuple[int, int], list[BeatContinuityState]] = {}
    billings = list(structure_billings)
    final_response_id = response_id
    issues: list[ContinuityIssue] = []
    for shard, result, shard_billings, shard_response_id in generated:
        key = (shard.scene_index, shard.shard_index)
        billings.extend(shard_billings)
        final_response_id = shard_response_id
        shard_results[key] = VisualBeatShardResult(visual_beats=result.visual_beats)
        continuity_states[key] = result.continuity_states
        issues.extend(
            _validate_shard_continuity_states(
                source_text=request.source_text,
                structure=structure,
                shard=shard,
                result=result,
            )
        )

    report = ContinuityReport(
        status=ContinuityReportStatus.NEEDS_REVIEW if issues else ContinuityReportStatus.PASS,
        issues=issues,
    )
    analysis = merge_shard_results(structure, shards, shard_results)
    return ChapterAnalysisPipelineResult(
        analysis=analysis,
        continuity_plan=structure.continuity_plan,
        continuity_states=continuity_states,
        report=report,
        billings=billings,
        final_response_id=final_response_id,
    )


async def _generate_structure(
    *,
    request: ChapterAnalysisRequest,
    adapter: StructuredAnalysisAdapter,
    repair_attempts: int,
) -> tuple[ChapterStructureWithContinuityResult, list[ProviderBilling], str]:
    reason: str | None = None
    billings: list[ProviderBilling] = []
    response_id = ""
    for attempt in range(repair_attempts + 1):
        result, billing, response_id = await adapter.generate(
            build_chapter_structure_prompt(
                request,
                repair_reason=reason if attempt > 0 else None,
            ),
            ChapterStructureWithContinuityResult,
        )
        billings.append(billing)
        if result is not None:
            try:
                validate_plan_source(result.continuity_plan, request.source_text)
            except ValueError as exc:
                reason = str(exc)
            else:
                return result, billings, response_id
        else:
            reason = "invalid structured chapter continuity output"
    raise ValueError(f"chapter structure rejected after bounded repair: {reason}")


def _shard_error(
    structure: ChapterStructureResult,
    shard: VisualBeatShard,
    result: VisualBeatShardWithContinuityResult | None,
) -> str | None:
    if result is None:
        return "invalid structured shard output"
    try:
        validate_visual_beat_shard(
            shard,
            VisualBeatShardResult(visual_beats=result.visual_beats),
            allowed_character_keys={
                ref.character_key for ref in structure.scenes[shard.scene_index].characters
            },
        )
    except ValueError as exc:
        return str(exc)
    if len(result.continuity_states) != len(result.visual_beats):
        return "continuity state count does not match visual beat count"
    return None


def _validate_shard_continuity_states(
    *,
    source_text: str,
    structure: ChapterStructureWithContinuityResult,
    shard: VisualBeatShard,
    result: VisualBeatShardWithContinuityResult,
) -> list[ContinuityIssue]:
    issues: list[ContinuityIssue] = []
    known_characters = {character.key for character in structure.characters}
    allowed_characters = {
        ref.character_key for ref in structure.scenes[shard.scene_index].characters
    }
    for beat, state in zip(result.visual_beats, result.continuity_states, strict=True):
        if beat.source_anchor not in shard.source_text:
            issues.append(_blocking("SOURCE_ANCHOR_MISSING", beat.source_anchor))
        for fact in state.visible_facts:
            if fact.subject_key in known_characters and fact.subject_key not in allowed_characters:
                issues.append(_blocking("CAST_SCOPE_VIOLATION", beat.source_anchor))
            if fact.evidence_anchor is not None and fact.evidence_anchor not in source_text:
                issues.append(_blocking("SOURCE_ANCHOR_MISSING", fact.evidence_anchor))
    return issues


def _blocking(code: str, anchor: str) -> ContinuityIssue:
    return ContinuityIssue(
        code=code,
        severity=ContinuityIssueSeverity.BLOCKING,
        evidenceAnchors=[anchor],
        message=f"Deterministic continuity validation failed: {code}",
        origin=ContinuityIssueOrigin.DETERMINISTIC,
    )
