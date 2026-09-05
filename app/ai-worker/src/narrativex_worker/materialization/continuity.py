"""Atomic materialization of immutable chapter/scene/beat continuity lineage."""

from __future__ import annotations

import json
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.continuity.schema import (
    BeatContinuityState,
    ChapterContinuityPlan,
    ContinuityReport,
)
from narrativex_worker.materialization.continuity_values import (
    json_array,
    report_origin,
    semantic_hash,
)
from narrativex_worker.repository.analysis_fingerprint import result_fingerprint
from narrativex_worker.schema import ChapterAnalysisResult


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
    states_by_scene = [
        [BeatContinuityState.model_validate(item) for item in raw_states]
        for raw_states in result.continuity_states
    ]
    if plan.source_hash != source_hash:
        raise RuntimeError("CONTINUITY_INPUT_STALE")
    if len(plan.scene_states) != len(result.scenes) or len(states_by_scene) != len(result.scenes):
        raise RuntimeError("continuity scene cardinality does not match storyboard")

    first_scene_id = scene_ids.get(0)
    if first_scene_id is None:
        raise RuntimeError("continuity materialization requires at least one storyboard scene")
    target = await connection.fetchrow(
        """
        SELECT sr.id AS storyboard_revision_id, sr.revision_number
          FROM scenes s
          JOIN storyboard_revisions sr ON sr.id = s.storyboard_revision_id
         WHERE s.id = $1
           AND s.chapter_id = $2
        """,
        first_scene_id,
        chapter_id,
    )
    if target is None:
        raise RuntimeError("continuity target storyboard revision could not be resolved")

    payload = {
        "plan": plan.model_dump(mode="json", by_alias=True),
        "states": [
            [state.model_dump(mode="json", by_alias=True) for state in states]
            for states in states_by_scene
        ],
        "report": report.model_dump(mode="json", by_alias=True),
    }
    _, result_hash = result_fingerprint(payload)
    revision = int(target["revision_number"])
    existing = await connection.fetchrow(
        """
        SELECT id, result_hash
          FROM chapter_continuity_plans
         WHERE chapter_id = $1 AND revision = $2
        """,
        chapter_id,
        revision,
    )
    if existing is not None:
        if existing["result_hash"] != result_hash:
            raise RuntimeError("continuity revision already exists with a different result")
        return existing["id"]

    plan_id = await connection.fetchval(
        """
        INSERT INTO chapter_continuity_plans
          (project_id, story_version_id, chapter_id, storyboard_revision_id, revision,
           source_hash, schema_version, prompt_version, model_config_json, plan_json, result_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'continuity-v1', '{}'::jsonb, $8::jsonb, $9)
        RETURNING id
        """,
        project_id,
        story_version_id,
        chapter_id,
        target["storyboard_revision_id"],
        revision,
        source_hash,
        plan.schema_version,
        json.dumps(plan.model_dump(mode="json", by_alias=True), ensure_ascii=False),
        result_hash,
    )
    if plan_id is None:
        raise RuntimeError("failed to persist chapter continuity plan")

    await _materialize_scene_states(
        connection,
        plan_id=plan_id,
        project_id=project_id,
        chapter_id=chapter_id,
        plan=plan,
        scene_ids=scene_ids,
    )
    await _materialize_beat_states(
        connection,
        plan_id=plan_id,
        project_id=project_id,
        chapter_id=chapter_id,
        result=result,
        states_by_scene=states_by_scene,
        scene_ids=scene_ids,
        beat_ids=beat_ids,
    )
    await connection.execute(
        """
        INSERT INTO continuity_reports (plan_id, revision, status, issues_json, origin)
        VALUES ($1, $2, $3, $4::jsonb, $5)
        """,
        plan_id,
        report.revision,
        report.status.value,
        json_array(list(report.issues)),
        report_origin(report),
    )
    return plan_id


async def _materialize_scene_states(
    connection: asyncpg.Connection,
    *,
    plan_id: UUID,
    project_id: UUID,
    chapter_id: UUID,
    plan: ChapterContinuityPlan,
    scene_ids: dict[int, UUID],
) -> None:
    await connection.executemany(
        """
        INSERT INTO scene_continuity_states
          (plan_id, project_id, chapter_id, scene_id, scene_key, timeline_key,
           entry_facts_json, exit_facts_json, event_keys_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)
        """,
        [
            (
                plan_id,
                project_id,
                chapter_id,
                scene_ids[index],
                state.scene_key,
                state.timeline_key,
                json_array(list(state.entry_facts)),
                json_array(list(state.exit_facts)),
                json.dumps(state.event_keys, ensure_ascii=False),
            )
            for index, state in enumerate(plan.scene_states)
        ],
    )


async def _materialize_beat_states(
    connection: asyncpg.Connection,
    *,
    plan_id: UUID,
    project_id: UUID,
    chapter_id: UUID,
    result: ChapterAnalysisResult,
    states_by_scene: list[list[BeatContinuityState]],
    scene_ids: dict[int, UUID],
    beat_ids: dict[tuple[UUID, int], UUID],
) -> None:
    rows: list[tuple[object, ...]] = []
    seen_keys: set[str] = set()
    for scene_index, states in enumerate(states_by_scene):
        if len(states) != len(result.scenes[scene_index].visual_beats):
            raise RuntimeError("continuity beat states do not match storyboard visual beats")
        scene_id = scene_ids[scene_index]
        for beat_index, state in enumerate(states):
            if state.beat_key in seen_keys:
                raise RuntimeError(f"duplicate continuity beat key {state.beat_key!r}")
            seen_keys.add(state.beat_key)
            rows.append(
                (
                    plan_id,
                    project_id,
                    chapter_id,
                    scene_id,
                    beat_ids[(scene_id, beat_index)],
                    state.beat_key,
                    json_array(list(state.entry_facts)),
                    json_array(list(state.visible_facts)),
                    json_array(list(state.exit_facts)),
                    json.dumps(state.event_keys, ensure_ascii=False),
                    semantic_hash(state.model_dump(mode="json", by_alias=True)),
                )
            )
    if rows:
        await connection.executemany(
            """
            INSERT INTO visual_beat_continuity_states
              (plan_id, project_id, chapter_id, scene_id, visual_beat_id, beat_key,
               entry_facts_json, visible_facts_json, exit_facts_json, event_keys_json,
               semantic_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11)
            """,
            rows,
        )
