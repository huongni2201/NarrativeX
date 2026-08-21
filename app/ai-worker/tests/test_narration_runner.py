import asyncio
import uuid
from collections import deque
from collections.abc import Callable
from typing import Any, cast

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.repository import ClaimedNarrationJob, NarrationWorkerRepository
from narrativex_worker.narration.runner import NarrationLeaseLostError, NarrationWorkerRunner


def claimed_job(index: int) -> ClaimedNarrationJob:
    return ClaimedNarrationJob(
        stage_attempt_id=index + 1,
        generation_job_id=index + 100,
        job_id=f"job-{index}",
        narration_request_id=uuid.uuid4(),
        project_id=1,
        chapter_id=index + 1,
        chapter_row_version=1,
        source_hash="a" * 64,
        source_text="A short chapter.",
        voice_id="voice",
        language="en-US",
        speaking_rate=1.0,
        request_fingerprint=f"request-{index}",
    )


class FakeNarrationRepository:
    def __init__(self, jobs: list[ClaimedNarrationJob]) -> None:
        self.jobs = deque(jobs)
        self.on_empty: Callable[[], None] | None = None
        self.claimed: list[ClaimedNarrationJob] = []
        self.connected = False
        self.closed = False
        self.fail_calls: list[tuple[Any, ...]] = []

    async def connect(self) -> None:
        self.connected = True

    async def close(self) -> None:
        self.closed = True

    async def claim_next(self, worker_id: str) -> ClaimedNarrationJob | None:
        del worker_id
        if not self.jobs:
            if self.on_empty is not None:
                self.on_empty()
            return None
        job = self.jobs.popleft()
        self.claimed.append(job)
        return job

    async def heartbeat(self, stage_attempt_id: int, worker_id: str) -> bool:
        del stage_attempt_id, worker_id
        return True

    async def fail(self, *args: Any) -> None:
        self.fail_calls.append(args)


def runner_with_repository(
    concurrency: int, repository: FakeNarrationRepository
) -> NarrationWorkerRunner:
    settings = WorkerSettings(
        _env_file=None,  # type: ignore[call-arg]
        worker_env="test",
        worker_concurrency=concurrency,
        poll_interval_seconds=0.001,
    )
    runner = NarrationWorkerRunner(settings)
    runner.enabled = True
    runner.repository = cast(NarrationWorkerRepository, repository)
    return runner


@pytest.mark.asyncio
async def test_narration_runner_limits_active_jobs_and_reaps_all_claims() -> None:
    repository = FakeNarrationRepository([claimed_job(index) for index in range(10)])
    runner = runner_with_repository(3, repository)
    repository.on_empty = runner.stop
    active = 0
    peak_active = 0

    async def process(claimed: ClaimedNarrationJob) -> None:
        nonlocal active, peak_active
        del claimed
        active += 1
        peak_active = max(peak_active, active)
        try:
            await asyncio.sleep(0.005)
        finally:
            active -= 1

    runner._process = process  # type: ignore[method-assign]
    await runner.start()

    assert len(repository.claimed) == 10
    assert peak_active == 3
    assert repository.connected
    assert repository.closed
    assert not runner._in_flight


@pytest.mark.asyncio
async def test_narration_stop_does_not_claim_after_current_jobs() -> None:
    repository = FakeNarrationRepository([claimed_job(index) for index in range(3)])
    runner = runner_with_repository(2, repository)
    started = asyncio.Event()
    release = asyncio.Event()
    active = 0

    async def process(claimed: ClaimedNarrationJob) -> None:
        nonlocal active
        del claimed
        active += 1
        started.set()
        try:
            await release.wait()
        finally:
            active -= 1

    runner._process = process  # type: ignore[method-assign]
    start_task = asyncio.create_task(runner.start())
    for _ in range(100):
        if len(repository.claimed) == 2:
            break
        await asyncio.sleep(0.001)
    await asyncio.wait_for(started.wait(), timeout=1)

    runner.stop()
    release.set()
    await asyncio.wait_for(start_task, timeout=1)

    assert len(repository.claimed) == 2
    assert repository.closed
    assert active == 0


@pytest.mark.asyncio
async def test_lease_loss_cancels_processing_without_marking_failed() -> None:
    repository = FakeNarrationRepository([])
    runner = runner_with_repository(1, repository)
    cancelled = asyncio.Event()

    async def process(claimed: ClaimedNarrationJob) -> None:
        del claimed
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled.set()
            raise

    async def lost_heartbeat(stage_attempt_id: int) -> None:
        del stage_attempt_id
        raise NarrationLeaseLostError("lost")

    runner._execute = process  # type: ignore[method-assign]
    runner._heartbeat_loop = lost_heartbeat  # type: ignore[method-assign]

    await runner._process(claimed_job(0))

    assert cancelled.is_set()
    assert not repository.fail_calls


def test_narration_pool_size_is_derived_from_worker_concurrency() -> None:
    runner = NarrationWorkerRunner(
        WorkerSettings(_env_file=None, worker_env="test", worker_concurrency=4)  # type: ignore[call-arg]
    )

    assert runner.repository.pool_size == 6
