"""Unit tests for chapter-analysis completion persistence boundaries."""

from uuid import UUID

import pytest

from narrativex_worker.repository import ClaimedChapterAnalysisJob, WorkerRepository
from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    SceneAnalysis,
    VisualBeatAnalysis,
)

PROJECT_ID = UUID("00000000-0000-4000-8000-000000000011")
STORY_VERSION_ID = UUID("00000000-0000-4000-8000-000000000012")
CHAPTER_ID = UUID("00000000-0000-4000-8000-000000000013")
STAGE_ATTEMPT_ID = UUID("00000000-0000-4000-8000-000000000014")
GENERATION_JOB_ID = UUID("00000000-0000-4000-8000-000000000015")


class _Transaction:
    async def __aenter__(self) -> "_Transaction":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None


class _Connection:
    def __init__(self) -> None:
        self.executed: list[tuple[str, tuple[object, ...]]] = []

    def transaction(self) -> _Transaction:
        return _Transaction()

    async def fetchval(self, query: str, *args: object) -> bool:
        assert "stage_attempts" in query or "chapters" in query
        return True

    async def execute(self, query: str, *args: object) -> str:
        self.executed.append((query, args))
        if "hashtextextended" in query:
            assert isinstance(args[0], str)
        return "UPDATE 1"


class _Acquire:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    async def __aenter__(self) -> _Connection:
        return self.connection

    async def __aexit__(self, *args: object) -> None:
        return None


class _Pool:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def acquire(self) -> _Acquire:
        return _Acquire(self.connection)


def _claimed_job() -> ClaimedChapterAnalysisJob:
    return ClaimedChapterAnalysisJob(
        stage_attempt_id=STAGE_ATTEMPT_ID,
        generation_job_id=GENERATION_JOB_ID,
        job_id="job-1",
        requested_by_user_id="user-1",
        request=ChapterAnalysisRequest(
            project_id=PROJECT_ID,
            story_version_id=STORY_VERSION_ID,
            chapter_id=CHAPTER_ID,
            chapter_row_version=4,
            source_hash="a" * 64,
            source_text="A short story.",
        ),
    )


def _result() -> ChapterAnalysisResult:
    return ChapterAnalysisResult(
        scenes=[
            SceneAnalysis(
                title="Opening",
                visual_beats=[VisualBeatAnalysis(title="Door", visual_intent="Warm light")],
            )
        ]
    )


@pytest.mark.asyncio
async def test_complete_binds_project_advisory_lock_key_as_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def empty_characters(*args: object) -> dict[str, UUID]:
        return {}

    async def empty_locations(*args: object) -> dict[str, UUID]:
        return {}

    async def empty_storyboard(*args: object) -> None:
        return None

    monkeypatch.setattr(
        "narrativex_worker.repository.implementation.materialize_characters",
        empty_characters,
    )
    monkeypatch.setattr(
        "narrativex_worker.repository.implementation.materialize_locations",
        empty_locations,
    )
    monkeypatch.setattr(
        "narrativex_worker.repository.implementation.materialize_storyboard",
        empty_storyboard,
    )

    connection = _Connection()
    repository = WorkerRepository("postgresql://unused", lease_seconds=30)
    repository._pool = _Pool(connection)  # type: ignore[assignment]

    await repository.complete(_claimed_job(), "worker-1", _result())

