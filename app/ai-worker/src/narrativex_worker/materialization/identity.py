"""Character and location materialization for Chapter analysis."""

import json

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.repository import ClaimedChapterAnalysisJob
from narrativex_worker.schema import ChapterAnalysisResult


async def materialize_characters(
    connection: asyncpg.Connection,
    claimed: ClaimedChapterAnalysisJob,
    result: ChapterAnalysisResult,
) -> dict[str, int]:
    if not result.characters:
        return {}

    existing_rows = await connection.fetch(
        """
        SELECT pc.id AS project_character_id,
               lower(c.canonical_name) AS canonical_name
          FROM project_characters pc
          JOIN characters c ON c.id = pc.character_id
         WHERE pc.project_id = $1
           AND pc.status = 'ACTIVE'
           AND lower(c.canonical_name) = ANY($2::text[])
        """,
        claimed.request.project_id,
        [character.name.lower() for character in result.characters],
    )
    existing = {row["canonical_name"]: row["project_character_id"] for row in existing_rows}
    materialized: dict[str, int] = {}
    updates: list[tuple[int, int, str | None]] = []

    for character in result.characters:
        normalized_name = character.name.lower()
        project_character_id = existing.get(normalized_name)
        if project_character_id is None:
            character_id = await connection.fetchval(
                """
                INSERT INTO characters (owner_id, canonical_name, aliases, status)
                VALUES ($1, $2, $3::jsonb, 'ACTIVE')
                RETURNING id
                """,
                claimed.requested_by_user_id,
                character.name,
                json.dumps(character.aliases, ensure_ascii=False),
            )
            version_id = await connection.fetchval(
                """
                INSERT INTO character_versions
                  (character_id, version_number, bible, visual_prompt, status)
                VALUES ($1, 1, $2, $2, 'DRAFT')
                RETURNING id
                """,
                character_id,
                character.description or character.name,
            )
            project_character_id = await connection.fetchval(
                """
                INSERT INTO project_characters
                  (project_id, character_id, role, importance, story_metadata,
                   pinned_character_version_id, status)
                VALUES ($1, $2, 'SUPPORTING', 0, $3, $4, 'ACTIVE')
                RETURNING id
                """,
                claimed.request.project_id,
                character_id,
                character.description or None,
                version_id,
            )
            existing[normalized_name] = project_character_id
        else:
            updates.append(
                (
                    claimed.request.project_id,
                    project_character_id,
                    character.description or None,
                )
            )
        materialized[character.key] = project_character_id

    if updates:
        await connection.executemany(
            """
            UPDATE project_characters
               SET story_metadata = $3, updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE project_id = $1 AND id = $2
            """,
            updates,
        )
    return materialized


async def materialize_locations(
    connection: asyncpg.Connection,
    claimed: ClaimedChapterAnalysisJob,
    result: ChapterAnalysisResult,
) -> dict[str, int]:
    if not result.locations:
        return {}

    existing_rows = await connection.fetch(
        """
        SELECT id, lower(name) AS normalized_name
          FROM project_locations
         WHERE project_id = $1
           AND status = 'ACTIVE'
           AND lower(name) = ANY($2::text[])
        """,
        claimed.request.project_id,
        [location.name.lower() for location in result.locations],
    )
    existing = {row["normalized_name"]: row["id"] for row in existing_rows}
    materialized: dict[str, int] = {}
    updates: list[tuple[int, int, str | None, str | None]] = []

    for location in result.locations:
        normalized_name = location.name.lower()
        project_location_id = existing.get(normalized_name)
        if project_location_id is None:
            project_location_id = await connection.fetchval(
                """
                INSERT INTO project_locations
                  (project_id, name, description, visual_prompt, status)
                VALUES ($1, $2, $3, $3, 'ACTIVE')
                RETURNING id
                """,
                claimed.request.project_id,
                location.name,
                location.description or None,
            )
            existing[normalized_name] = project_location_id
        else:
            updates.append(
                (
                    claimed.request.project_id,
                    project_location_id,
                    location.description or None,
                    location.description or None,
                )
            )
        materialized[location.key] = project_location_id

    if updates:
        await connection.executemany(
            """
            UPDATE project_locations
               SET description = $3, visual_prompt = $4,
                   updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
             WHERE project_id = $1 AND id = $2 AND status = 'ACTIVE'
            """,
            updates,
        )
    return materialized
