import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from narrativex_worker.translation_worker import TranslationWorkerRunner


@pytest.mark.asyncio
async def test_process_threads_claim_owner_into_work_task() -> None:
    runner = object.__new__(TranslationWorkerRunner)
    runner.worker_id = "process-worker"
    runner.logger = SimpleNamespace(
        warning=lambda *args, **kwargs: None,
        exception=lambda *args, **kwargs: None,
    )
    runner.repository = SimpleNamespace(fail=AsyncMock())

    heartbeat_started = asyncio.Event()

    async def heartbeat(*args: object) -> None:
        heartbeat_started.set()
        await asyncio.Event().wait()

    work = AsyncMock(return_value=None)
    runner._heartbeat = heartbeat  # type: ignore[method-assign]
    runner._process_claimed = work  # type: ignore[method-assign]
    claimed = SimpleNamespace(job_id="job-1")

    await runner._process(claimed, "claim-owner-1")

    assert heartbeat_started.is_set()
    work.assert_awaited_once_with(claimed, "claim-owner-1")


def test_claim_owner_is_unique_and_bounded() -> None:
    runner = object.__new__(TranslationWorkerRunner)
    runner.worker_id = "worker-" + "x" * 200

    first = runner._new_claim_owner()
    second = runner._new_claim_owner()

    assert first != second
    assert first != runner.worker_id
    assert second != runner.worker_id
    assert len(first) <= 128
    assert len(second) <= 128
