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
    AnalysisStepIdentity,
    ChapterAnalysisPipelineResult,
    ChapterStructureWithContinuityResult,
    StructuredAnalysisAdapter,
    VisualBeatShardWithContinuityResult,
)
from narrativex_worker.continuity.pipeline_validation import shard_validation_error
from narrativex_worker.continuity.planner import validate_plan_source
from narrativex_worker.continuity.schema import (
    BeatContinuityState,
    ContinuityIssue,
    ContinuityIssueSeverity,
    ContinuityReport,
    ContinuityReportStatus,
)
from narrativex_worker.continuity.validator import validate_shard_result
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
    ) -> tuple[
        VisualBeatShard,
        VisualBeatShardWithContinuityResult,
        list[ProviderBilling],
        str,
        list[ContinuityIssue],
    ]:
        reason: str | None = None
        billings: list[ProviderBilling] = []
        shard_response_id = response_id
        context = contexts[(shard.scene_index, shard.shard_index)]
        last_valid_result: VisualBeatShardWithContinuityResult | None = None
        last_issues: list[ContinuityIssue] = []

        for attempt in range(repair_attempts + 1):
            result, billing, shard_response_id = await adapter.generate(
                build_visual_beat_shard_prompt(
                    request,
                    structure,
                    shard,
                    continuity_context=context,
                    repair_reason=reason if attempt > 0 else None,
                ),
                VisualBeatShardWithContinuityResult,
                identity=AnalysisStepIdentity(
                    step_key=(
                        f"shard:{shard.scene_index}:{shard.shard_index}"
                        if attempt == 0
                        else f"repair:{shard.scene_index}:{shard.shard_index}:{attempt}"
                    ),
                    owned_source_range={
                        "start": shard.source_start,
                        "end": shard.source_end,
                        "source": shard.source_text,
                    },
                    continuity_inputs=context.model_dump(mode="json", by_alias=True),
                ),
            )
            billings.append(billing)
            reason = shard_validation_error(structure, shard, result)
            if reason is not None or result is None:
                continue

            last_valid_result = result
            last_issues = validate_shard_result(
                source_text=request.source_text,
                structure=structure,
                plan=structure.continuity_plan,
                shard=shard,
                context=context,
                result=result,
            )
            blocking = [
                issue
                for issue in last_issues
                if issue.severity is ContinuityIssueSeverity.BLOCKING
            ]
            if not blocking:
                return shard, result, billings, shard_response_id, last_issues
            reason = "deterministic continuity conflicts: " + ",".join(
                sorted({issue.code for issue in blocking})
            )

        if last_valid_result is not None:
            # A structurally valid result remains reviewable after bounded repair is exhausted.
            return shard, last_valid_result, billings, shard_response_id, last_issues
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
    for shard, result, shard_billings, shard_response_id, shard_issues in generated:
        key = (shard.scene_index, shard.shard_index)
        billings.extend(shard_billings)
        final_response_id = shard_response_id
        shard_results[key] = VisualBeatShardResult(visual_beats=result.visual_beats)
        continuity_states[key] = result.continuity_states
        issues.extend(shard_issues)

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
            identity=AnalysisStepIdentity(
                step_key="structure" if attempt == 0 else f"structure-repair:{attempt}",
                owned_source_range={
                    "start": 0,
                    "end": len(request.source_text),
                    "source": request.source_text,
                },
            ),
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
