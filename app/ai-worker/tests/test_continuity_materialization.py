"""Regression tests for Chapter analysis continuity materialization."""

from typing import Any

import pytest
from pydantic import ValidationError

from narrativex_worker.prompting import build_chapter_analysis_prompt
from narrativex_worker.repository import ClaimedChapterAnalysisJob, WorkerRepository
from narrativex_worker.schema import ChapterAnalysisRequest, ChapterAnalysisResult

SOURCE_HASH = "b" * 64


def claimed_job() -> ClaimedChapterAnalysisJob:
    return ClaimedChapterAnalysisJob(
        stage_attempt_id=10,
        generation_job_id=20,
        job_id="job-1",
        requested_by_user_id="user-1",
        request=ChapterAnalysisRequest(
            project_id=1,
            story_version_id=2,
            chapter_id=3,
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


def test_prompt_requires_stable_continuity_keys() -> None:
    prompt = build_chapter_analysis_prompt(claimed_job().request)
    assert "stable ASCII key" in prompt
    assert "character_key" in prompt
    assert "location_key" in prompt


class ExistingCharacterConnection:
    def __init__(self) -> None:
        self.executemany_calls: list[tuple[str, Any]] = []

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        del args
        assert "FROM project_characters" in query
        return [{"project_character_id": 201, "canonical_name": "hero"}]

    async def executemany(self, query: str, args: Any) -> None:
        self.executemany_calls.append((query, args))


@pytest.mark.asyncio
async def test_character_materializer_maps_provider_key_to_project_character() -> None:
    connection = ExistingCharacterConnection()

    materialized = await WorkerRepository._materialize_characters(
        connection,
        claimed_job(),
        continuity_result(),
    )

    assert materialized == {"hero": 201}
    assert len(connection.executemany_calls) == 1
    assert "UPDATE project_characters" in connection.executemany_calls[0][0]


class NewLocationConnection:
    def __init__(self) -> None:
        self.insert_args: tuple[object, ...] | None = None

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        del args
        assert "FROM project_locations" in query
        return []

    async def fetchval(self, query: str, *args: object) -> int:
        assert "INSERT INTO project_locations" in query
        self.insert_args = args
        return 301

    async def executemany(self, query: str, args: Any) -> None:
        raise AssertionError(f"unexpected executemany: {query!r}, {args!r}")


@pytest.mark.asyncio
async def test_location_materializer_persists_location_and_maps_provider_key() -> None:
    connection = NewLocationConnection()

    materialized = await WorkerRepository._materialize_locations(
        connection,
        claimed_job(),
        continuity_result(),
    )

    assert materialized == {"old-house": 301}
    assert connection.insert_args is not None
    assert connection.insert_args[0] == 1
    assert connection.insert_args[1] == "Old House"


class StoryboardConnection:
    def __init__(self) -> None:
        self.scene_insert_args: tuple[object, ...] | None = None
        self.executemany_calls: list[tuple[str, Any]] = []

    async def fetchval(self, query: str, *args: object) -> bool:
        del args
        assert "SELECT EXISTS" in query
        return False

    async def execute(self, query: str, *args: object) -> str:
        del args
        assert "DELETE FROM" in query
        return "DELETE 0"

    async def fetch(self, query: str, *args: object) -> list[dict[str, int]]:
        assert "INSERT INTO scenes" in query
        self.scene_insert_args = args
        return [{"id": 1001, "order_index": 0}]

    async def executemany(self, query: str, args: Any) -> None:
        self.executemany_calls.append((query, args))


@pytest.mark.asyncio
async def test_storyboard_materializer_persists_scene_character_and_location_links() -> None:
    connection = StoryboardConnection()

    await WorkerRepository._materialize_storyboard(
        connection,
        claimed_job(),
        continuity_result(),
        {"hero": 201},
        {"old-house": 301},
    )

    assert connection.scene_insert_args is not None
    assert connection.scene_insert_args[4] == [301]

    scene_character_call = next(
        call for call in connection.executemany_calls if "INSERT INTO scene_characters" in call[0]
    )
    assert scene_character_call[1] == [(1001, 0, 201)]

    visual_beat_call = next(
        call for call in connection.executemany_calls if "INSERT INTO visual_beats" in call[0]
    )
    assert visual_beat_call[1] == [(1001, 0, "Threshold", "The hero crosses a dusty threshold.")]
