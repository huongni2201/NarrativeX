"""Revision-safe storyboard materialization for Chapter analysis."""

from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.schema import ChapterAnalysisResult
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
        if beat_rows:
            await connection.executemany(
                """
                INSERT INTO visual_beats
                  (scene_id, order_index, title, visual_intent, motion_mode,
                   camera_movement, camera_angle, review_status)
                VALUES ($1, $2, $3, $4, 'STILL', $5, $6, 'NEEDS_REVIEW')
                """,
                beat_rows,
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
