"""Revision-safe storyboard materialization for Chapter analysis."""

from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.schema import ChapterAnalysisResult
from narrativex_worker.visual_alignment import resolve_visual_beat_ranges
from narrativex_worker.visual_density import (
    estimated_narration_duration_ms,
    latest_narration_duration_ms,
    validate_visual_beat_density,
)
from narrativex_worker.visual_prompt.director import choose_ffmpeg_camera_movement

if TYPE_CHECKING:
    from narrativex_worker.repository import ClaimedChapterAnalysisJob


async def materialize_storyboard(
    connection: asyncpg.Connection,
    claimed: "ClaimedChapterAnalysisJob",
    result: ChapterAnalysisResult,
    project_characters: dict[str, UUID],
    project_locations: dict[str, UUID],
) -> None:
    revision = await connection.fetchrow(
        """
        SELECT sr.id, sr.source_hash, sr.source_row_version, sr.status
          FROM generation_jobs gj
          JOIN storyboard_revisions sr ON sr.id = gj.storyboard_revision_id
         WHERE gj.id = $1
           AND gj.chapter_id = $2
         FOR UPDATE OF sr
        """,
        claimed.generation_job_id,
        claimed.request.chapter_id,
    )
    if revision is None:
        raise RuntimeError("Analysis job has no durable storyboard revision target")
    if revision["status"] != "DRAFT":
        raise RuntimeError("Storyboard revision target is not writable")
    if revision["source_hash"] != claimed.request.source_hash:
        raise RuntimeError("Storyboard revision source snapshot does not match the analysis job")
    if revision["source_row_version"] != claimed.request.chapter_row_version:
        raise RuntimeError("Storyboard revision row version does not match the analysis job")

    narration_duration_ms = await latest_narration_duration_ms(
        connection,
        chapter_id=claimed.request.chapter_id,
        source_hash=claimed.request.source_hash,
    )
    planning_duration_ms = narration_duration_ms or estimated_narration_duration_ms(
        claimed.request.source_text
    )
    validate_visual_beat_density(result, duration_ms=planning_duration_ms)

    target_revision_id = revision["id"]

    await connection.execute(
        """
        DELETE FROM visual_beats
         WHERE scene_id IN (
             SELECT id FROM scenes WHERE storyboard_revision_id = $1
         )
        """,
        target_revision_id,
    )
    await connection.execute(
        "DELETE FROM scenes WHERE storyboard_revision_id = $1",
        target_revision_id,
    )

    if result.scenes:
        location_ids = [
            project_locations[scene.location_key] if scene.location_key is not None else None
            for scene in result.scenes
        ]
        scene_rows = await connection.fetch(
            """
            INSERT INTO scenes
              (chapter_id, storyboard_revision_id, order_index, title, narration,
               project_location_id, status)
            SELECT $1, $2, source.order_index, source.title, source.narration,
                   source.project_location_id, 'DRAFT'
              FROM UNNEST($3::int[], $4::text[], $5::text[], $6::uuid[])
                   AS source(order_index, title, narration, project_location_id)
             ORDER BY source.order_index
            RETURNING id, order_index
            """,
            claimed.request.chapter_id,
            target_revision_id,
            list(range(len(result.scenes))),
            [scene.title for scene in result.scenes],
            [scene.narration or "" for scene in result.scenes],
            location_ids,
        )
        scene_ids = {row["order_index"]: row["id"] for row in scene_rows}

        scene_character_rows = [
            (
                scene_ids[scene_index],
                character_index,
                project_characters[character.character_key],
            )
            for scene_index, scene in enumerate(result.scenes)
            for character_index, character in enumerate(scene.characters)
        ]
        if scene_character_rows:
            await connection.executemany(
                """
                INSERT INTO scene_characters
                  (scene_id, order_index, project_character_id)
                VALUES ($1, $2, $3)
                """,
                scene_character_rows,
            )

        flattened_beats = [
            beat for scene in result.scenes for beat in scene.visual_beats
        ]
        anchors = [beat.source_anchor for beat in flattened_beats]
        if not all(anchor is not None for anchor in anchors):
            raise ValueError("visual beat source anchors are required")
        anchored_ranges = resolve_visual_beat_ranges(
            claimed.request.source_text,
            [anchor for anchor in anchors if anchor is not None],
        )

        beat_rows = [
            (
                scene_ids[scene_index],
                beat_index,
                beat.title,
                beat.visual_intent,
                choose_ffmpeg_camera_movement(beat.title, beat.visual_intent),
                beat.camera_angle.value,
            )
            for scene_index, scene in enumerate(result.scenes)
            for beat_index, beat in enumerate(scene.visual_beats)
        ]
        beat_ids: dict[tuple[UUID, int], UUID] = {}
        if beat_rows:
            inserted_beats = await connection.fetch(
                """
                INSERT INTO visual_beats
                  (scene_id, order_index, title, visual_intent, motion_mode,
                   camera_movement, camera_angle, review_status)
                SELECT source.scene_id, source.order_index, source.title, source.visual_intent,
                       'STILL', source.camera_movement, source.camera_angle, 'NEEDS_REVIEW'
                  FROM UNNEST(
                       $1::uuid[], $2::int[], $3::text[], $4::text[], $5::text[], $6::text[])
                       AS source(scene_id, order_index, title, visual_intent,
                                 camera_movement, camera_angle)
                 ORDER BY source.scene_id, source.order_index
                RETURNING id, scene_id, order_index
                """,
                [row[0] for row in beat_rows],
                [row[1] for row in beat_rows],
                [row[2] for row in beat_rows],
                [row[3] for row in beat_rows],
                [row[4] for row in beat_rows],
                [row[5] for row in beat_rows],
            )
            beat_ids = {
                (row["scene_id"], row["order_index"]): row["id"] for row in inserted_beats
            }

        ordered_ids = [
            beat_ids[(scene_ids[scene_index], beat_index)]
            for scene_index, scene in enumerate(result.scenes)
            for beat_index, _ in enumerate(scene.visual_beats)
        ]
        await connection.executemany(
            """
            UPDATE visual_beats
               SET text_start = $2,
                   text_end = $3,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = $1
            """,
            [
                (beat_id, text_range.text_start, text_range.text_end)
                for beat_id, text_range in zip(ordered_ids, anchored_ranges, strict=True)
            ],
        )

        beat_character_rows = [
            (
                beat_ids[(scene_ids[scene_index], beat_index)],
                project_characters[character.character_key],
                character.role.value,
            )
            for scene_index, scene in enumerate(result.scenes)
            for beat_index, beat in enumerate(scene.visual_beats)
            for character in beat.characters
        ]
        if beat_character_rows:
            await connection.executemany(
                """
                INSERT INTO visual_beat_characters
                  (visual_beat_id, project_character_id, role)
                VALUES ($1, $2, $3)
                """,
                beat_character_rows,
            )

    chapter_update = await connection.execute(
        """
        UPDATE chapters
           SET current_storyboard_revision_id = $2,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND row_version = $3
           AND source_hash = $4
        """,
        claimed.request.chapter_id,
        target_revision_id,
        claimed.request.chapter_row_version,
        claimed.request.source_hash,
    )
    if chapter_update != "UPDATE 1":
        raise RuntimeError("Chapter changed before storyboard revision activation")
