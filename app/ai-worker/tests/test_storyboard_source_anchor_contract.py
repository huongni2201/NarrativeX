"""Regression coverage for generated storyboard source-anchor requirements."""

from uuid import UUID

import pytest

from narrativex_worker.materialization.storyboard import materialize_storyboard
from narrativex_worker.repository import ClaimedChapterAnalysisJob
from narrativex_worker.schema import ChapterAnalysisRequest, ChapterAnalysisResult

SOURCE_HASH = "c" * 64
CHAPTER_ID = UUID("00000000-0000-4000-8000-000000000003")
SCENE_ID = UUID("00000000-0000-4000-8000-000000001001")
BEAT_ID = UUID("00000000-0000-4000-8000-000000002001")


def _claimed_job() -> ClaimedChapterAnalysisJob:
    return ClaimedChapterAnalysisJob(
        stage_attempt_id=10,
        generation_job_id=20,
        job_id="job-source-anchor-contract",
        requested_by_user_id="user-1",
        request=ChapterAnalysisRequest(
            project_id="00000000-0000-4000-8000-000000000001",
            story_version_id="00000000-0000-4000-8000-000000000002",
            chapter_id=CHAPTER_ID,
            chapter_row_version=4,
            source_hash=SOURCE_HASH,
            source_text="Hero opens the door. Rain falls outside.",
        ),
    )


def _result_without_source_anchors() -> ChapterAnalysisResult:
    return ChapterAnalysisResult.model_validate(
        {
            "scenes": [
                {
                    "title": "Arrival",
                    "visual_beats": [
                        {
                            "title": "Door",
                            "visual_intent": "Hero opens the door.",
                        },
                        {
                            "title": "Rain",
                            "visual_intent": "Rain falls outside.",
                        },
                    ],
                }
            ]
        }
    )


class StoryboardConnection:
    async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
        assert "storyboard_revisions" in query
        assert args == (20, CHAPTER_ID)
        return {
            "id": 501,
            "source_hash": SOURCE_HASH,
            "source_row_version": 4,
            "status": "DRAFT",
        }

    async def execute(self, query: str, *args: object) -> str:
        if "UPDATE chapters" in query:
            return "UPDATE 1"
        assert "DELETE FROM" in query
        return "DELETE 0"

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        if "INSERT INTO scenes" in query:
            return [{"id": SCENE_ID, "order_index": 0}]
        assert "INSERT INTO visual_beats" in query
        return [
            {"id": BEAT_ID, "scene_id": SCENE_ID, "order_index": 0},
            {
                "id": UUID("00000000-0000-4000-8000-000000002002"),
                "scene_id": SCENE_ID,
                "order_index": 1,
            },
        ]

    async def executemany(self, query: str, args: object) -> None:
        raise AssertionError(f"unexpected executemany call: {query} {args}")


@pytest.mark.asyncio
async def test_storyboard_materializer_rejects_when_all_source_anchors_are_missing() -> None:
    with pytest.raises(ValueError, match="visual beat source anchors are required"):
        await materialize_storyboard(
            StoryboardConnection(),
            _claimed_job(),
            _result_without_source_anchors(),
            {},
            {},
        )
