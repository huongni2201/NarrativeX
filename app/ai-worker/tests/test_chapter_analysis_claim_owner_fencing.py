import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

from narrativex_worker.repository import WorkerRepository
from narrativex_worker.repository.implementation import (
    WorkerRepository as WorkerRepositoryImplementation,
)


@pytest.mark.asyncio
async def test_reclaimed_stage_keeps_old_and_new_tasks_on_distinct_claim_owners() -> None:
    repository = WorkerRepository("postgresql://unused", lease_seconds=30)
    stage_attempt_id = UUID("018f0000-0000-7000-8000-000000000001")
    claimed = SimpleNamespace(stage_attempt_id=stage_attempt_id)
    gate = asyncio.Event()

    async def heartbeat_after_reclaim() -> bool:
        await gate.wait()
        return await repository.heartbeat(stage_attempt_id, "process-worker")

    with (
        patch.object(
            WorkerRepositoryImplementation,
            "claim_next",
            new=AsyncMock(side_effect=[claimed, claimed]),
        ) as claim_next,
        patch.object(
            WorkerRepositoryImplementation,
            "heartbeat",
            new=AsyncMock(return_value=True),
        ) as heartbeat,
    ):
        await repository.claim_next("process-worker")
        stale_task = asyncio.create_task(heartbeat_after_reclaim())

        await repository.claim_next("process-worker")
        current_task = asyncio.create_task(
            repository.heartbeat(stage_attempt_id, "process-worker")
        )

        gate.set()
        assert await stale_task is True
        assert await current_task is True

    first_owner = claim_next.await_args_list[0].args[0]
    second_owner = claim_next.await_args_list[1].args[0]
    heartbeat_owners = {call.args[1] for call in heartbeat.await_args_list}

    assert first_owner != second_owner
    assert first_owner != "process-worker"
    assert second_owner != "process-worker"
    assert heartbeat_owners == {first_owner, second_owner}
    assert len(first_owner) <= 128
    assert len(second_owner) <= 128
