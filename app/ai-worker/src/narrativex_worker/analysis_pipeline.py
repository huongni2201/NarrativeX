"""Continuity-first chapter analysis orchestration independent from provider adapters."""

from __future__ import annotations

import asyncio

from narrativex_worker.chapter_analysis_prompts import (
    build_chapter_structure_prompt,
    build_visual_beat_shard_prompt,
)
from narrativex_worker.chapter_analysis_sharding import (
    VisualBeatShard,
    VisualBeatShardResult,
    merge_shard_results,
    plan_visual_beat_shards,
)
from narrativex_worker.continuity.context import build_shard_continuity_contexts
from narrativex_worker.continuity.pipeline_contracts import (
    ChapterAnalysisPipelineResult,
    ChapterStructureWithContinuityResult,
    StructuredAnalysisAdapter,
    VisualBeatShardWithContinuityResult,
)
from narrativex_worker.continuity.pipeline_validation import (
    shard_validation_error,
    validate_shard_continuity_states,
)
from narrativex_worker.continuity.planner import validate_plan_source
from narrativex_worker.continuity.schema import (
    BeatContinuityState,
    ContinuityIssue,
    ContinuityReport,
    ContinuityReportStatus,
)
from narrativex_worker.providers.ports import ProviderBilling
from narrativex_worker.schema import ChapterAnalysisRequest


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
            reason = shard_validation_error(structure, shard, result)
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
            validate_shard_continuity_states(
                source_text=request.source_text,
                structure=structure,
                shard=shard,
                result=result,
            )
        )

    analysis = merge_shard_results(structure, shards, shard_results)
    return ChapterAnalysisPipelineResult(
        analysis=analysis,
        continuity_plan=structure.continuity_plan,
        continuity_states=continuity_states,
        report=ContinuityReport(
            status=ContinuityReportStatus.NEEDS_REVIEW if issues else ContinuityReportStatus.PASS,
            issues=issues,
        ),
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
        if result is None:
            reason = "invalid structured chapter continuity output"
            continue
        try:
            validate_plan_source(result.continuity_plan, request.source_text)
        except ValueError as exc:
            reason = str(exc)
            continue
        return result, billings, response_id
    raise ValueError(f"chapter structure rejected after bounded repair: {reason}")
