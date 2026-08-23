import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from narrativex_worker.translation import TranslationProviderResponse
from narrativex_worker.translation_repository import (
    ClaimedTranslationJob,
    TranslationOperation,
)
from narrativex_worker.translation_worker import (
    TranslationLeaseLostError,
    TranslationWorkerRunner,
)


def claimed_job() -> ClaimedTranslationJob:
    return ClaimedTranslationJob(
        stage_attempt_id=11,
        generation_job_id=22,
        job_id="job-22",
        chapter_id=33,
        project_id=44,
        source_variant_id=55,
        source_content_hash="a" * 64,
        source_language="en-US",
        source_text="first chunk second chunk",
        target_language="vi-VN",
    )


@pytest.mark.asyncio
async def test_heartbeat_raises_when_lease_update_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runner = object.__new__(TranslationWorkerRunner)
    runner.settings = SimpleNamespace(lease_seconds=6)
    runner.worker_id = "worker-1"
    runner.repository = SimpleNamespace(heartbeat=Mock(return_value=_false_async()))

    async def no_wait(_: float) -> None:
        return None

    monkeypatch.setattr(asyncio, "sleep", no_wait)

    with pytest.raises(TranslationLeaseLostError):
        await runner._heartbeat(claimed_job())


async def _false_async() -> bool:
    return False


@pytest.mark.asyncio
async def test_chunk_operations_are_reserved_and_completed_individually(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runner = object.__new__(TranslationWorkerRunner)
    runner.settings = SimpleNamespace(vertex_model="gemini-test")
    runner.gate = asyncio.Semaphore(1)
    runner.provider = SimpleNamespace(
        translate=AsyncMock(
            side_effect=[
                TranslationProviderResponse("một", "vertex", "gemini-test", Mock()),
                TranslationProviderResponse("hai", "vertex", "gemini-test", Mock()),
            ]
        )
    )
    runner.repository = FakeTranslationRepository()
    runner.worker_id = "worker-1"
    monkeypatch.setattr("narrativex_worker.translation_worker.chunk_text", lambda _: ["one", "two"])
    monkeypatch.setattr(
        "narrativex_worker.translation_worker.validate_translation", lambda *_: None
    )

    await runner._process_claimed(claimed_job())

    assert runner.repository.reserved_indexes == [0, 1]
    assert len(runner.repository.completed_operations) == 2
    assert runner.repository.final_content == "một\n\nhai"


class FakeTranslationRepository:
    def __init__(self) -> None:
        self.reserved_indexes: list[int] = []
        self.completed_operations: list[TranslationProviderResponse] = []
        self.final_content: str | None = None

    async def reserve_chunk_operation(
        self,
        _: ClaimedTranslationJob,
        __: str,
        chunk_index: int,
        ___: str,
    ) -> TranslationOperation:
        self.reserved_indexes.append(chunk_index)
        return TranslationOperation(chunk_index + 1, "RESERVED", 0)

    async def fence_before_provider_call(
        self, operation: TranslationOperation
    ) -> TranslationOperation:
        return TranslationOperation(operation.id, "UNKNOWN", operation.row_version + 1)

    async def complete_chunk_operation(
        self,
        _: ClaimedTranslationJob,
        __: str,
        ___: TranslationOperation,
        response: TranslationProviderResponse,
    ) -> None:
        self.completed_operations.append(response)

    async def complete_translation(
        self, _: ClaimedTranslationJob, __: str, content: str, ___: str, ____: str
    ) -> None:
        self.final_content = content
