import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

from narrativex_worker.narration.repository import NarrationWorkerRepository
from narrativex_worker.narration.repository.implementation import (
    NarrationWorkerRepository as NarrationWorkerRepositoryImplementation,
)


@pytest.mark.asyncio
async def test_reclaimed_narration_stage_keeps_distinct_task_local_claim_owners() -> None:
    repository = NarrationWorkerRepository("postgresql://unused", lease_seconds=30)
    stage_attempt_id = UUID("018f0000-0000-7000-8000-000000000001")
    claimed = SimpleNamespace(stage_attempt_id=stage_attempt_id)
    gate = asyncio.Event()

    async def stale_heartbeat_after_reclaim() -> bool:
        await gate.wait()
        return await repository.heartbeat(stage_attempt_id, "process-worker")

    with (
        patch.object(
            NarrationWorkerRepositoryImplementation,
            "claim_next",
            new=AsyncMock(side_effect=[claimed, claimed]),
        ) as claim_next,
        patch.object(
            NarrationWorkerRepositoryImplementation,
            "heartbeat",
            new=AsyncMock(return_value=True),
        ) as heartbeat,
    ):
        await repository.claim_next("process-worker")
        stale_task = asyncio.create_task(stale_heartbeat_after_reclaim())

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
    assert heartbeat_owners == {first_owner, second_owner}
    assert len(first_owner) <= 128
    assert len(second_owner) <= 128


@pytest.mark.asyncio
async def test_reconciliation_claim_also_receives_unique_owner() -> None:
    repository = NarrationWorkerRepository("postgresql://unused", lease_seconds=30)
    claimed = SimpleNamespace(
        stage_attempt_id=UUID("018f0000-0000-7000-8000-000000000002")
    )

    with patch.object(
        NarrationWorkerRepositoryImplementation,
        "claim_due_reconciliation",
        new=AsyncMock(return_value=claimed),
    ) as claim_due:
        assert await repository.claim_due_reconciliation("process-worker") is claimed

    owner = claim_due.await_args.args[0]
    assert owner != "process-worker"
    assert len(owner) <= 128
