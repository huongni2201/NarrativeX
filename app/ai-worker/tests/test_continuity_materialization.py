"""Regression tests for Chapter analysis continuity materialization."""

from typing import Any

import pytest
from pydantic import ValidationError

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


class StoryboardConnection:
    def __init__(self) -> None:
        self.scene_insert_args: tuple[object, ...] | None = None
        self.executemany_calls: list[tuple[str, Any]] = []

    async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
        assert "storyboard_revisions" in query
        assert args == (20, 3)
        return {
            "id": 501,
            "source_hash": SOURCE_HASH,
            "source_row_version": 4,
            "status": "DRAFT",
        }

    async def execute(self, query: str, *args: object) -> str:
        if "UPDATE chapters" in query:
            assert args == (3, 501, 4, SOURCE_HASH)
            return "UPDATE 1"
        assert "DELETE FROM" in query
        assert args == (501,)
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

    await materialize_storyboard(
        connection,  # type: ignore[arg-type]
        claimed_job(),
        continuity_result(),
        {"hero": 201},
        {"old-house": 301},
    )

    assert connection.scene_insert_args is not None
    assert connection.scene_insert_args[1] == 501
    assert connection.scene_insert_args[5] == [301]

    scene_character_call = next(
        call for call in connection.executemany_calls if "INSERT INTO scene_characters" in call[0]
    )
    assert scene_character_call[1] == [(1001, 0, 201)]

    visual_beat_call = next(
        call for call in connection.executemany_calls if "INSERT INTO visual_beats" in call[0]
    )
    assert visual_beat_call[1] == [(1001, 0, "Threshold", "The hero crosses a dusty threshold.")]
