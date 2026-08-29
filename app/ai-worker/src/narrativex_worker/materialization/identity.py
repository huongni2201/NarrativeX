"""Project-scoped AI identity materialization for Chapter continuity."""

import json
import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.schema import CharacterAnalysis, ChapterAnalysisResult

if TYPE_CHECKING:
    from narrativex_worker.repository import ClaimedChapterAnalysisJob


@dataclass(frozen=True)
class _Candidate:
    entity_id: UUID
    names: tuple[str, ...]


@dataclass(frozen=True)
class _Match:
    entity_id: UUID
    basis: str
    confidence: float


async def materialize_characters(
    connection: asyncpg.Connection,
    claimed: "ClaimedChapterAnalysisJob",
    result: ChapterAnalysisResult,
) -> dict[str, UUID]:
    if not result.characters:
        return {}

    project_id = claimed.request.project_id
    chapter_id = claimed.request.chapter_id
    keys = [character.key for character in result.characters]

    identity_rows = await connection.fetch(
        """
        SELECT ai_key, project_character_id
          FROM project_character_ai_identities
         WHERE project_id = $1
           AND ai_key = ANY($2::text[])
        """,
        project_id,
        keys,
    )
    existing_by_key = {row["ai_key"]: row["project_character_id"] for row in identity_rows}

    candidate_rows = await connection.fetch(
        """
        SELECT pc.id AS project_character_id,
               c.canonical_name,
               c.aliases,
               COALESCE(
                   jsonb_agg(DISTINCT identity.observation)
                       FILTER (WHERE identity.observation IS NOT NULL),
                   '[]'::jsonb
               ) AS identity_observations
          FROM project_characters pc
          JOIN characters c ON c.id = pc.character_id
          LEFT JOIN LATERAL (
              SELECT jsonb_array_elements_text(pci.observations) AS observation
                FROM project_character_ai_identities pci
               WHERE pci.project_id = pc.project_id
                 AND pci.project_character_id = pc.id
          ) identity ON TRUE
         WHERE pc.project_id = $1
           AND pc.status = 'ACTIVE'
         GROUP BY pc.id, c.canonical_name, c.aliases
         ORDER BY pc.id
        """,
        project_id,
    )
    candidates = [
        _Candidate(
            entity_id=row["project_character_id"],
            names=_candidate_names(
                row["canonical_name"],
                _json_string_list(row["aliases"]),
                _json_string_list(row["identity_observations"]),
            ),
        )
        for row in candidate_rows
    ]

    materialized: dict[str, UUID] = {}
    assigned_in_response: dict[UUID, str] = {}

    for character in result.characters:
        project_character_id = existing_by_key.get(character.key)
        basis = "EXACT_KEY"
        confidence = 1.0

        if project_character_id is None:
            match = _unique_candidate_match(
                character.name,
                character.aliases,
                candidates,
                excluded_entity_ids=set(assigned_in_response),
            )
            if match is not None:
                project_character_id = match.entity_id
                basis = match.basis
                confidence = match.confidence
            else:
                project_character_id = await _create_character(
                    connection,
                    claimed,
                    character.name,
                    character.aliases,
                    character.description,
                )
                basis = "CREATED"
                confidence = 1.0

            await connection.execute(
                """
                INSERT INTO project_character_ai_identities
                  (project_id, ai_key, project_character_id, aliases, observations,
                   first_seen_chapter_id, last_seen_chapter_id, match_basis, confidence)
                VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $6, $7, $8)
                ON CONFLICT (project_id, ai_key) DO NOTHING
                """,
                project_id,
                character.key,
                project_character_id,
                json.dumps(character.aliases, ensure_ascii=False),
                json.dumps(
                    _observation_values(character.name, character.aliases),
                    ensure_ascii=False,
                ),
                chapter_id,
                basis,
                confidence,
            )

            durable_entity_id = await connection.fetchval(
                """
                SELECT project_character_id
                  FROM project_character_ai_identities
                 WHERE project_id = $1 AND ai_key = $2
                """,
                project_id,
                character.key,
            )
            if durable_entity_id is None:
                raise RuntimeError(
                    f"Character identity mapping disappeared for key {character.key!r}"
                )
            project_character_id = durable_entity_id

        owner_key = assigned_in_response.get(project_character_id)
        if owner_key is not None and owner_key != character.key:
            raise RuntimeError(
                "Distinct character keys resolved to the same project character in one "
                f"response: {owner_key!r}, {character.key!r}"
            )
        assigned_in_response[project_character_id] = character.key
        materialized[character.key] = project_character_id

        await connection.execute(
            """
            UPDATE project_character_ai_identities
               SET aliases = (
                       SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
                         FROM jsonb_array_elements_text(
                             aliases || $3::jsonb
                         ) AS merged(value)
                   ),
                   observations = (
                       SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
                         FROM jsonb_array_elements_text(
                             observations || $4::jsonb
                         ) AS merged(value)
                   ),
                   last_seen_chapter_id = $5,
                   updated_at = CURRENT_TIMESTAMP
             WHERE project_id = $1
               AND ai_key = $2
            """,
            project_id,
            character.key,
            json.dumps(character.aliases, ensure_ascii=False),
            json.dumps(
                _observation_values(character.name, character.aliases),
                ensure_ascii=False,
            ),
            chapter_id,
        )
        await _materialize_character_profile(
            connection,
            project_id,
            chapter_id,
            project_character_id,
            character,
        )

    return materialized


async def _materialize_character_profile(
    connection: asyncpg.Connection,
    project_id: UUID,
    chapter_id: UUID,
    project_character_id: UUID,
    character: CharacterAnalysis,
) -> None:
    """Persist AI profile data without replacing an explicitly pinned character version."""
    row = await connection.fetchrow(
        """
        SELECT character_id, pinned_character_version_id, role, importance, groups_json
          FROM project_characters
         WHERE project_id = $1 AND id = $2
         FOR UPDATE
        """,
        project_id,
        project_character_id,
    )
    if row is None:
        raise RuntimeError(f"Project character {project_character_id} disappeared during analysis")

    existing_groups = _json_string_list(row["groups_json"])
    merged_groups = list(dict.fromkeys([*existing_groups, *character.groups]))
    inferred_role = character.role.strip() or "SUPPORTING"
    existing_role = str(row["role"] or "SUPPORTING")
    role = inferred_role if existing_role == "SUPPORTING" else existing_role
    importance = max(int(row["importance"] or 0), character.importance)

    await connection.execute(
        """
        UPDATE project_characters
           SET role = $3,
               importance = $4,
               groups_json = $5::jsonb,
               story_metadata = COALESCE(NULLIF($6, ''), story_metadata),
               updated_at = CURRENT_TIMESTAMP,
               row_version = row_version + 1
         WHERE project_id = $1 AND id = $2
        """,
        project_id,
        project_character_id,
        role,
        importance,
        json.dumps(merged_groups, ensure_ascii=False),
        character.description.strip(),
    )

    character_id = UUID(str(row["character_id"]))
    if row["pinned_character_version_id"] is None:
        await _create_and_pin_character_version(
            connection,
            project_id,
            project_character_id,
            character_id,
            character,
        )

    await _upsert_character_appearance(
        connection,
        project_id,
        chapter_id,
        character_id,
        character,
    )


async def _create_and_pin_character_version(
    connection: asyncpg.Connection,
    project_id: UUID,
    project_character_id: UUID,
    character_id: UUID,
    character: CharacterAnalysis,
) -> None:
    bible = character.bible.strip() or character.description.strip() or character.name
    visual_prompt = (
        character.visual_prompt.strip()
        or character.appearance_prompt.strip()
        or character.description.strip()
        or character.name
    )
    version_number = await connection.fetchval(
        """
        SELECT COALESCE(MAX(version_number), 0) + 1
          FROM character_versions
         WHERE character_id = $1
        """,
        character_id,
    )
    version_id = await connection.fetchval(
        """
        INSERT INTO character_versions
          (character_id, version_number, bible, visual_prompt, status)
        VALUES ($1, $2, $3, $4, 'DRAFT')
        RETURNING id
        """,
        character_id,
        int(version_number or 1),
        bible,
        visual_prompt,
    )
    if version_id is None:
        raise RuntimeError(f"Failed to create character version for {character_id}")

    await connection.execute(
        """
        UPDATE project_characters
           SET pinned_character_version_id = $3,
               updated_at = CURRENT_TIMESTAMP,
               row_version = row_version + 1
         WHERE project_id = $1
           AND id = $2
           AND pinned_character_version_id IS NULL
        """,
        project_id,
        project_character_id,
        version_id,
    )


async def _upsert_character_appearance(
    connection: asyncpg.Connection,
    project_id: UUID,
    chapter_id: UUID,
    character_id: UUID,
    character: CharacterAnalysis,
) -> None:
    appearance_values = (
        character.age_state.strip(),
        character.hairstyle.strip(),
        character.injury.strip(),
        character.wardrobe_context.strip(),
        character.appearance_prompt.strip(),
    )
    if not any(appearance_values):
        return

    timeline_key = f"chapter:{chapter_id}"
    appearance_id = await connection.fetchval(
        """
        SELECT id
          FROM character_appearances
         WHERE character_id = $1
           AND project_id = $2
           AND timeline_key = $3
         ORDER BY updated_at DESC, id DESC
         LIMIT 1
        """,
        character_id,
        project_id,
        timeline_key,
    )
    if appearance_id is None:
        await connection.execute(
            """
            INSERT INTO character_appearances
              (character_id, project_id, timeline_key, age_state, hairstyle, injury,
               wardrobe_context, appearance_prompt)
            VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''),
                    NULLIF($7, ''), NULLIF($8, ''))
            """,
            character_id,
            project_id,
            timeline_key,
            *appearance_values,
        )
        return

    await connection.execute(
        """
        UPDATE character_appearances
           SET age_state = NULLIF($2, ''),
               hairstyle = NULLIF($3, ''),
               injury = NULLIF($4, ''),
               wardrobe_context = NULLIF($5, ''),
               appearance_prompt = NULLIF($6, ''),
               updated_at = CURRENT_TIMESTAMP,
               row_version = row_version + 1
         WHERE id = $1
        """,
        appearance_id,
        *appearance_values,
    )


async def materialize_locations(
    connection: asyncpg.Connection,
    claimed: "ClaimedChapterAnalysisJob",
    result: ChapterAnalysisResult,
) -> dict[str, UUID]:
    if not result.locations:
        return {}

    project_id = claimed.request.project_id
    chapter_id = claimed.request.chapter_id
    keys = [location.key for location in result.locations]

    identity_rows = await connection.fetch(
        """
        SELECT ai_key, project_location_id
          FROM project_location_ai_identities
         WHERE project_id = $1
           AND ai_key = ANY($2::text[])
        """,
        project_id,
        keys,
    )
    existing_by_key = {row["ai_key"]: row["project_location_id"] for row in identity_rows}

    candidate_rows = await connection.fetch(
        """
        SELECT pl.id AS project_location_id,
               pl.name,
               COALESCE(
                   jsonb_agg(DISTINCT identity.observation)
                       FILTER (WHERE identity.observation IS NOT NULL),
                   '[]'::jsonb
               ) AS identity_observations
          FROM project_locations pl
          LEFT JOIN LATERAL (
              SELECT jsonb_array_elements_text(pli.observations) AS observation
                FROM project_location_ai_identities pli
               WHERE pli.project_id = pl.project_id
                 AND pli.project_location_id = pl.id
          ) identity ON TRUE
         WHERE pl.project_id = $1
           AND pl.status = 'ACTIVE'
         GROUP BY pl.id, pl.name
         ORDER BY pl.id
        """,
        project_id,
    )
    candidates = [
        _Candidate(
            entity_id=row["project_location_id"],
            names=_candidate_names(
                row["name"],
                (),
                _json_string_list(row["identity_observations"]),
            ),
        )
        for row in candidate_rows
    ]

    materialized: dict[str, UUID] = {}
    assigned_in_response: dict[UUID, str] = {}

    for location in result.locations:
        project_location_id = existing_by_key.get(location.key)
        basis = "EXACT_KEY"
        confidence = 1.0
        visual_prompt = (
            location.visual_prompt.strip()
            or location.description.strip()
            or location.name
        )

        if project_location_id is None:
            match = _unique_candidate_match(
                location.name,
                (),
                candidates,
                excluded_entity_ids=set(assigned_in_response),
            )
            if match is not None:
                project_location_id = match.entity_id
                basis = match.basis
                confidence = match.confidence
            else:
                project_location_id = await connection.fetchval(
                    """
                    INSERT INTO project_locations
                      (project_id, name, description, visual_prompt, status)
                    VALUES ($1, $2, $3, $4, 'ACTIVE')
                    RETURNING id
                    """,
                    project_id,
                    location.name,
                    location.description or None,
                    visual_prompt,
                )
                basis = "CREATED"
                confidence = 1.0

            await connection.execute(
                """
                INSERT INTO project_location_ai_identities
                  (project_id, ai_key, project_location_id, aliases, observations,
                   first_seen_chapter_id, last_seen_chapter_id, match_basis, confidence)
                VALUES ($1, $2, $3, '[]'::jsonb, $4::jsonb, $5, $5, $6, $7)
                ON CONFLICT (project_id, ai_key) DO NOTHING
                """,
                project_id,
                location.key,
                project_location_id,
                json.dumps([location.name], ensure_ascii=False),
                chapter_id,
                basis,
                confidence,
            )

            durable_entity_id = await connection.fetchval(
                """
                SELECT project_location_id
                  FROM project_location_ai_identities
                 WHERE project_id = $1 AND ai_key = $2
                """,
                project_id,
                location.key,
            )
            if durable_entity_id is None:
                raise RuntimeError(
                    f"Location identity mapping disappeared for key {location.key!r}"
                )
            project_location_id = durable_entity_id

        owner_key = assigned_in_response.get(project_location_id)
        if owner_key is not None and owner_key != location.key:
            raise RuntimeError(
                "Distinct location keys resolved to the same project location in one "
                f"response: {owner_key!r}, {location.key!r}"
            )
        assigned_in_response[project_location_id] = location.key
        materialized[location.key] = project_location_id

        await connection.execute(
            """
            UPDATE project_location_ai_identities
               SET observations = (
                       SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
                         FROM jsonb_array_elements_text(
                             observations || $3::jsonb
                         ) AS merged(value)
                   ),
                   last_seen_chapter_id = $4,
                   updated_at = CURRENT_TIMESTAMP
             WHERE project_id = $1
               AND ai_key = $2
            """,
            project_id,
            location.key,
            json.dumps([location.name], ensure_ascii=False),
            chapter_id,
        )
        await connection.execute(
            """
            UPDATE project_locations
               SET description = $3,
                   visual_prompt = $4,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE project_id = $1 AND id = $2 AND status = 'ACTIVE'
            """,
            project_id,
            project_location_id,
            location.description or None,
            visual_prompt,
        )

    return materialized


async def _create_character(
    connection: asyncpg.Connection,
    claimed: "ClaimedChapterAnalysisJob",
    name: str,
    aliases: list[str],
    description: str,
) -> UUID:
    character_id = await connection.fetchval(
        """
        INSERT INTO characters (owner_id, canonical_name, aliases, status)
        VALUES ($1, $2, $3::jsonb, 'ACTIVE')
        RETURNING id
        """,
        claimed.requested_by_user_id,
        name,
        json.dumps(aliases, ensure_ascii=False),
    )
    project_character_id = await connection.fetchval(
        """
        INSERT INTO project_characters
          (project_id, character_id, role, importance, story_metadata, status)
        VALUES ($1, $2, 'SUPPORTING', 0, $3, 'ACTIVE')
        RETURNING id
        """,
        claimed.request.project_id,
        character_id,
        description or None,
    )
    if project_character_id is None:
        raise RuntimeError("Failed to create project character")
    return UUID(str(project_character_id))


def _json_string_list(value: object) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        parsed = json.loads(value)
    else:
        parsed = value
    if not isinstance(parsed, list):
        return ()
    return tuple(item for item in parsed if isinstance(item, str) and item.strip())


def _candidate_names(
    name: str,
    aliases: Iterable[str],
    observations: Iterable[str],
) -> tuple[str, ...]:
    values = [name, *aliases, *observations]
    deduplicated: dict[str, None] = {}
    for value in values:
        normalized = _normalize_identity_text(value)
        if normalized:
            deduplicated.setdefault(normalized, None)
    return tuple(deduplicated)


def _observation_values(name: str, aliases: Iterable[str]) -> list[str]:
    deduplicated: dict[str, str] = {}
    for value in (name, *aliases):
        normalized = _normalize_identity_text(value)
        if normalized:
            deduplicated.setdefault(normalized, value.strip())
    return list(deduplicated.values())


def _unique_candidate_match(
    name: str,
    aliases: Iterable[str],
    candidates: Iterable[_Candidate],
    *,
    excluded_entity_ids: set[UUID],
) -> _Match | None:
    mention_names = _candidate_names(name, aliases, ())
    scored: list[_Match] = []

    for candidate in candidates:
        if candidate.entity_id in excluded_entity_ids:
            continue
        best_score = 0.0
        for mention in mention_names:
            for candidate_name in candidate.names:
                best_score = max(best_score, _identity_similarity(mention, candidate_name))
        if best_score >= 0.84:
            basis = "ALIAS" if best_score >= 0.99 else "CANDIDATE"
            scored.append(_Match(candidate.entity_id, basis, best_score))

    if not scored:
        return None
    scored.sort(key=lambda match: (-match.confidence, match.entity_id))
    best_match = scored[0]
    if len(scored) > 1 and scored[1].confidence >= best_match.confidence - 0.05:
        return None
    return best_match


def _identity_similarity(left: str, right: str) -> float:
    if left == right:
        return 1.0
    left_tokens = left.split()
    right_tokens = right.split()
    if not left_tokens or not right_tokens:
        return 0.0

    left_set = set(left_tokens)
    right_set = set(right_tokens)
    intersection = len(left_set & right_set)
    if intersection == 0:
        return 0.0

    containment = intersection / min(len(left_set), len(right_set))
    union = intersection / len(left_set | right_set)
    if containment == 1.0:
        return 0.88 + 0.08 * union
    return 0.70 * containment + 0.30 * union


def _normalize_identity_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(char for char in normalized if not unicodedata.combining(char))
    lowered = without_marks.casefold()
    return re.sub(r"[^a-z0-9]+", " ", lowered).strip()
