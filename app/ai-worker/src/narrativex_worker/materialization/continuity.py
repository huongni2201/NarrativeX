"""Atomic materialization of immutable chapter/scene/beat continuity lineage."""

from __future__ import annotations

import hashlib
import json
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.continuity.schema import (
    BeatContinuityState,
    ChapterContinuityPlan,
    ContinuityReport,
)
from narrativex_worker.schema import ChapterAnalysisResult


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


async def materialize_continuity(
    connection: asyncpg.Connection,
    *,
    project_id: UUID,
    chapter_id: UUID,
    story_version_id: UUID,
    source_hash: str,
    result: ChapterAnalysisResult,
    scene_ids: dict[int, UUID],
    beat_ids: dict[tuple[UUID, int], UUID],
) -> UUID | None:
    if result.continuity_plan is None:
        if result.continuity_states is not None or result.continuity_report is not None:
            raise RuntimeError("continuity metadata is incomplete")
        return None
    if result.continuity_states is None or result.continuity_report is None:
        raise RuntimeError("continuity plan requires states and report")

    plan = ChapterContinuityPlan.model_validate(result.continuity_plan)
    report = ContinuityReport.model_validate(result.continuity_report)
    if plan.source_hash != source_hash:
        raise RuntimeError("CONTINUITY_INPUT_STALE")
    if len(plan.scene_states) != len(result.scenes):
        raise RuntimeError("continuity scene states do not match storyboard scenes")
    if len(result.continuity_states) != len(result.scenes):
        raise RuntimeError("continuity beat state groups do not match storyboard scenes")

    plan_payload = plan.model_dump(mode="json", by_alias=True)
    plan_json = _canonical_json(plan_payload)
    result_hash = hashlib.sha256(plan_json.encode("utf-8")).hexdigest()
    plan_id = await connection.fetchval(
        """
        INSERT INTO chapter_continuity_plans
          (project_id, chapter_id, story_version_id, source_hash, revision,
           schema_version, prompt_version, model_key, plan_json, result_hash)
        SELECT $1, $2, $3, $4,
               COALESCE(MAX(existing.revision), 0) + 1,
               $5, 'chapter-continuity-v1', 'provider-configured', $6::jsonb, $7
          FROM chapter_continuity_plans existing
         WHERE existing.chapter_id = $2
        RETURNING id
        """,
        project_id,
        chapter_id,
        story_version_id,
        source_hash,
        plan.schema_version,
        plan_json,
        result_hash,
    )
    if plan_id is None:
        raise RuntimeError("failed to persist chapter continuity plan")

    for scene_index, scene_state in enumerate(plan.scene_states):
        await connection.execute(
            """
            INSERT INTO scene_continuity_states
              (plan_id, scene_id, scene_key, timeline_key, entry_facts_json,
               exit_facts_json, event_keys_json)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
            """,
            plan_id,
            scene_ids[scene_index],
            scene_state.scene_key,
            scene_state.timeline_key,
            _canonical_json(
                [fact.model_dump(mode="json", by_alias=True) for fact in scene_state.entry_facts]
            ),
            _canonical_json(
                [fact.model_dump(mode="json", by_alias=True) for fact in scene_state.exit_facts]
            ),
            _canonical_json(scene_state.event_keys),
        )

        raw_states = result.continuity_states[scene_index]
        states = [BeatContinuityState.model_validate(item) for item in raw_states]
        if len(states) != len(result.scenes[scene_index].visual_beats):
            raise RuntimeError("continuity beat states do not match storyboard visual beats")
        scene_id = scene_ids[scene_index]
        for beat_index, state in enumerate(states):
            state_payload = state.model_dump(mode="json", by_alias=True)
            semantic_hash = hashlib.sha256(
                _canonical_json(state_payload).encode("utf-8")
            ).hexdigest()
            await connection.execute(
                """
                INSERT INTO visual_beat_continuity_states
                  (plan_id, visual_beat_id, beat_key, entry_facts_json, visible_facts_json,
                   exit_facts_json, event_keys_json, semantic_hash)
                VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8)
                """,
                plan_id,
                beat_ids[(scene_id, beat_index)],
                state.beat_key,
                _canonical_json(
                    [fact.model_dump(mode="json", by_alias=True) for fact in state.entry_facts]
                ),
                _canonical_json(
                    [fact.model_dump(mode="json", by_alias=True) for fact in state.visible_facts]
                ),
                _canonical_json(
                    [fact.model_dump(mode="json", by_alias=True) for fact in state.exit_facts]
                ),
                _canonical_json(state.event_keys),
                semantic_hash,
            )

    await connection.execute(
        """
        INSERT INTO continuity_reports
          (plan_id, revision, status, issues_json, origin)
        VALUES ($1, 1, $2, $3::jsonb, 'DETERMINISTIC')
        """,
        plan_id,
        report.status.value,
        _canonical_json(
            [issue.model_dump(mode="json", by_alias=True) for issue in report.issues]
        ),
    )
    return plan_id
