"""Regression tests for Chapter analysis continuity materialization."""

from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError

from narrativex_worker.materialization.identity import materialize_locations
from narrativex_worker.materialization.storyboard import materialize_storyboard
from narrativex_worker.prompting import build_chapter_analysis_prompt
from narrativex_worker.repository import ClaimedChapterAnalysisJob
from narrativex_worker.schema import ChapterAnalysisRequest, ChapterAnalysisResult

SOURCE_HASH = "b" * 64


def claimed_job() -> ClaimedChapterAnalysisJob:
    return ClaimedChapterAnalysisJob(
        stage_attempt_id=10,
        generation_job_id=20,
        job_id="job-1",
        requested_by_user_id="user-1",
        request=ChapterAnalysisRequest(
            project_id="00000000-0000-4000-8000-000000000001",
            story_version_id="00000000-0000-4000-8000-000000000002",
            chapter_id="00000000-0000-4000-8000-000000000003",
            chapter_row_version=4,
            source_hash=SOURCE_HASH,
            source_text="Hero enters the old house.",
        ),
    )


def continuity_result() -> ChapterAnalysisResult:
    return ChapterAnalysisResult.model_validate(
        {
            "characters": [
                {
                    "key": "hero",
                    "name": "Hero",
                    "aliases": ["The Hero"],
                    "description": "A determined traveler.",
                }
            ],
            "locations": [
                {
                    "key": "old-house",
                    "name": "Old House",
                    "description": "An abandoned wooden house.",
                    "visual_prompt": "weathered timber walls, narrow porch, broken green shutters",
                }
            ],
            "scenes": [
                {
                    "title": "Arrival",
                    "narration": "The hero enters the old house.",
                    "characters": [{"character_key": "hero"}],
                    "location_key": "old-house",
                    "visual_beats": [
                        {
                            "title": "Threshold",
                            "visual_intent": "The hero crosses a dusty threshold.",
                            "characters": [{"character_key": "hero", "role": "PRIMARY"}],
                        }
                    ],
                }
            ],
        }
    )


def test_analysis_result_rejects_dangling_character_reference() -> None:
    with pytest.raises(ValidationError, match="unknown character_key"):
        ChapterAnalysisResult.model_validate(
            {
                "characters": [],
                "scenes": [
                    {
                        "title": "Broken",
                        "characters": [{"character_key": "missing"}],
                        "visual_beats": [{"title": "Beat", "visual_intent": "Intent"}],
                    }
                ],
            }
        )


def test_analysis_result_rejects_dangling_location_reference() -> None:
    with pytest.raises(ValidationError, match="unknown location_key"):
        ChapterAnalysisResult.model_validate(
            {
                "locations": [],
                "scenes": [
                    {
                        "title": "Broken",
                        "location_key": "missing",
                        "visual_beats": [{"title": "Beat", "visual_intent": "Intent"}],
                    }
                ],
            }
        )


def test_analysis_result_rejects_beat_character_not_in_parent_scene() -> None:
    with pytest.raises(ValidationError, match="not present in the scene"):
        ChapterAnalysisResult.model_validate(
            {
                "characters": [
                    {"key": "hero", "name": "Hero"},
                    {"key": "friend", "name": "Friend"},
                ],
                "scenes": [
                    {
                        "title": "Solo",
                        "characters": [{"character_key": "hero"}],
                        "visual_beats": [
                            {
                                "title": "Beat",
                                "visual_intent": "Hero stands alone.",
                                "characters": [
                                    {"character_key": "friend", "role": "SECONDARY"}
                                ],
                            }
                        ],
                    }
                ],
            }
        )


def test_prompt_requires_stable_continuity_keys_and_beat_roles() -> None:
    prompt = build_chapter_analysis_prompt(claimed_job().request)
    assert "stable ASCII key" in prompt
    assert "character_key" in prompt
    assert "location_key" in prompt
    assert "ONLY the characters actually visible" in prompt
    assert "PRIMARY, SECONDARY, or BACKGROUND" in prompt


class StoryboardConnection:
    def __init__(self) -> None:
        self.scene_insert_args: tuple[object, ...] | None = None
        self.beat_insert_args: tuple[object, ...] | None = None
        self.executemany_calls: list[tuple[str, Any]] = []

    async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
        assert "storyboard_revisions" in query
        assert args == (20, UUID("00000000-0000-4000-8000-000000000003"))
        return {
            "id": 501,
            "source_hash": SOURCE_HASH,
            "source_row_version": 4,
            "status": "DRAFT",
        }

    async def execute(self, query: str, *args: object) -> str:
        if "UPDATE chapters" in query:
            assert args == (
                UUID("00000000-0000-4000-8000-000000000003"),
                501,
                4,
                SOURCE_HASH,
            )
            return "UPDATE 1"
        assert "DELETE FROM" in query
        assert args == (501,)
        return "DELETE 0"

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        if "INSERT INTO scenes" in query:
            self.scene_insert_args = args
            return [{"id": UUID("00000000-0000-4000-8000-000000001001"), "order_index": 0}]
        assert "INSERT INTO visual_beats" in query
        self.beat_insert_args = args
        return [
            {
                "id": UUID("00000000-0000-4000-8000-000000002001"),
                "scene_id": UUID("00000000-0000-4000-8000-000000001001"),
                "order_index": 0,
            }
        ]

    async def executemany(self, query: str, args: Any) -> None:
        self.executemany_calls.append((query, args))


class LocationConnection:
    def __init__(self) -> None:
        self.project_location_id = UUID("00000000-0000-4000-8000-000000000301")
        self.location_write_args: tuple[object, ...] | None = None
        self.location_write_query: str | None = None

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        if "project_location_ai_identities" in query and "SELECT ai_key" in query:
            return []
        if "FROM project_locations pl" in query:
            return []
        raise AssertionError(query)

    async def fetchval(self, query: str, *args: object) -> object:
        if "INSERT INTO project_locations" in query:
            assert args[1] == "Old House"
            assert args[2] == "An abandoned wooden house."
            assert args[3] == "weathered timber walls, narrow porch, broken green shutters"
            return self.project_location_id
        if "SELECT project_location_id" in query:
            return self.project_location_id
        raise AssertionError(query)

    async def execute(self, query: str, *args: object) -> str:
        if "INSERT INTO project_location_ai_identities" in query:
            return "INSERT 1"
        if "UPDATE project_location_ai_identities" in query:
            return "UPDATE 1"
        if "UPDATE project_locations" in query:
            self.location_write_query = query
            self.location_write_args = args
            return "UPDATE 1"
        raise AssertionError(query)


@pytest.mark.asyncio
async def test_location_materializer_keeps_description_separate_from_visual_canon() -> None:
    connection = LocationConnection()
    result = await materialize_locations(connection, claimed_job(), continuity_result())

    assert result == {"old-house": connection.project_location_id}
    assert connection.location_write_args is not None
    assert connection.location_write_args[2] == "An abandoned wooden house."
    assert (
        connection.location_write_args[3]
        == "weathered timber walls, narrow porch, broken green shutters"
    )
    assert connection.location_write_query is not None
    assert "COALESCE(NULLIF(visual_prompt, ''), $4)" in connection.location_write_query


@pytest.mark.asyncio
async def test_storyboard_materializer_persists_scene_beat_character_and_location_links() -> None:
    connection = StoryboardConnection()
    project_character_id = UUID("00000000-0000-4000-8000-000000000201")
    project_location_id = UUID("00000000-0000-4000-8000-000000000301")

    await materialize_storyboard(
        connection,
        claimed_job(),
        continuity_result(),
        {"hero": project_character_id},
        {"old-house": project_location_id},
    )

    assert connection.scene_insert_args is not None
    assert connection.scene_insert_args[1] == 501
    assert connection.scene_insert_args[5] == [project_location_id]

    scene_character_call = next(
        call for call in connection.executemany_calls if "INSERT INTO scene_characters" in call[0]
    )
    assert scene_character_call[1] == [
        (UUID("00000000-0000-4000-8000-000000001001"), 0, project_character_id)
    ]

    assert connection.beat_insert_args is not None
    assert connection.beat_insert_args[0] == [UUID("00000000-0000-4000-8000-000000001001")]
    assert connection.beat_insert_args[1:] == (
        [0],
        ["Threshold"],
        ["The hero crosses a dusty threshold."],
        ["NONE"],
        ["MEDIUM"],
    )

    beat_character_call = next(
        call
        for call in connection.executemany_calls
        if "INSERT INTO visual_beat_characters" in call[0]
    )
    assert beat_character_call[1] == [
        (
            UUID("00000000-0000-4000-8000-000000002001"),
            project_character_id,
            "PRIMARY",
        )
    ]
