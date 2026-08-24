from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest

from narrativex_worker.narration.repository import NarrationWorkerRepository
from narrativex_worker.narration.storage import StoredMediaAsset


class _Transaction:
    async def __aenter__(self) -> "_Transaction":
        return self

    async def __aexit__(self, exception_type: object, exception: object, traceback: object) -> None:
        return None


class _Connection:
    def __init__(self) -> None:
        self.execute_calls: list[tuple[str, tuple[Any, ...]]] = []

    def transaction(self) -> _Transaction:
        return _Transaction()

    async def fetchval(self, query: str, *args: Any) -> Any:
        if "SELECT EXISTS" in query:
            return True
        if "INSERT INTO project_assets" in query:
            return UUID("018f0000-0000-7000-8000-000000000010")
        raise AssertionError(f"Unexpected fetchval query: {query}")

    async def fetchrow(self, query: str, *args: Any) -> Any:
        if "FROM narration_assets" in query:
            return None
        raise AssertionError(f"Unexpected fetchrow query: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        self.execute_calls.append((query, args))
        if "UPDATE stage_attempts" in query:
            return "UPDATE 1"
        if "UPDATE generation_jobs" in query:
            return "UPDATE 1"
        return "INSERT 0 1"


class _Acquire:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    async def __aenter__(self) -> _Connection:
        return self.connection

    async def __aexit__(self, exception_type: object, exception: object, traceback: object) -> None:
        return None


class _Pool:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def acquire(self) -> _Acquire:
        return _Acquire(self.connection)


@pytest.mark.asyncio
async def test_public_narration_completion_uses_uuidv7_for_durable_ids() -> None:
    connection = _Connection()
    repository = NarrationWorkerRepository("postgresql://unused", lease_seconds=30)
    repository._pool = _Pool(connection)  # type: ignore[assignment]

    claimed = SimpleNamespace(
        stage_attempt_id=UUID("018f0000-0000-7000-8000-000000000001"),
        generation_job_id=UUID("018f0000-0000-7000-8000-000000000002"),
        narration_request_id=UUID("018f0000-0000-7000-8000-000000000003"),
        project_id=UUID("018f0000-0000-7000-8000-000000000004"),
        chapter_id=UUID("018f0000-0000-7000-8000-000000000005"),
        source_hash="a" * 64,
    )
    stored = StoredMediaAsset(
        storage_key="narration/chapter.mp3",
        checksum="b" * 64,
        size_bytes=4096,
        mime_type="audio/mpeg",
    )
    spans = [
        SimpleNamespace(
            index=0,
            text_start=0,
            text_end=12,
            audio_start_ms=0,
            audio_end_ms=800,
        )
    ]

    await repository.complete(
        claimed,
        "claim-owner-1",
        stored,
        duration_ms=800,
        sample_rate_hz=48000,
        channels=1,
        spans=spans,
    )

    asset_insert = next(
        call for call in connection.execute_calls if "INSERT INTO narration_assets" in call[0]
    )
    alignment_insert = next(
        call for call in connection.execute_calls if "INSERT INTO narration_alignments" in call[0]
    )

    narration_asset_id = asset_insert[1][0]
    narration_alignment_id = alignment_insert[1][0]
    assert isinstance(narration_asset_id, UUID)
    assert isinstance(narration_alignment_id, UUID)
    assert narration_asset_id.version == 7
    assert narration_alignment_id.version == 7
    assert alignment_insert[1][1] == narration_asset_id
