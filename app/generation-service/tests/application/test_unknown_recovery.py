from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest

from conftest import FakeExecutor
from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)
from narrativex_gpu_worker.application.errors import AmbiguousOutcomeError, CapacityError
from narrativex_gpu_worker.application.ports.execution import ExecutionContext, ExecutionOutput
from narrativex_gpu_worker.application.services.execution import ExecutionApplicationService
from narrativex_gpu_worker.contracts import ComputeTask, ExecutionState, request_fingerprint
from narrativex_gpu_worker.domain.submission import SubmissionState


async def wait_unknown(runtime: ExecutionApplicationService, task: ComputeTask) -> None:
    async with asyncio.timeout(5):
        while True:
            observation = await runtime.get(task.task_id, task.attempt_id)
            if observation is not None and observation.error is not None:
                return
            await asyncio.sleep(0.01)


class LostAckExecutor(FakeExecutor):
    async def execute(self, task, cancel, context=None):
        self.calls += 1
        assert context is not None and context.save_submitting is not None
        await context.save_submitting()
        raise AmbiguousOutcomeError("provider response must not be exposed")


class CorrelatedRecoveryExecutor(FakeExecutor):
    async def recover_handle(self, task: ComputeTask) -> str | None:
        return "recovered-existing-handle"

    async def execute(self, task, cancel, context=None):
        self.calls += 1
        assert context.existing_execution_handle == "recovered-existing-handle"
        return ExecutionOutput(execution_handle=context.existing_execution_handle)


async def test_missing_handle_unknown_can_recover_by_read_only_correlation(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "lookup.sqlite3")
    await journal.initialize()
    await journal.save_accepted(compute_task)
    await journal.mark_submitting(compute_task.task_id, compute_task.attempt_id)
    executor = CorrelatedRecoveryExecutor()
    runtime = ExecutionApplicationService(journal, ExecutorCatalog((executor,)), 1)
    await runtime.start()
    try:
        async with asyncio.timeout(5):
            while True:
                observation = await runtime.get(compute_task.task_id, compute_task.attempt_id)
                if observation and observation.state == ExecutionState.SUCCEEDED:
                    break
                await asyncio.sleep(0.01)
        assert executor.calls == 1
    finally:
        await runtime.stop()


async def test_lost_ack_remains_recoverable_and_replay_does_not_dispatch(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    executor = LostAckExecutor()
    runtime = ExecutionApplicationService(journal, ExecutorCatalog((executor,)), 1)
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        await wait_unknown(runtime, compute_task)
        observation = await runtime.get(compute_task.task_id, compute_task.attempt_id)
        assert observation is not None and observation.state == ExecutionState.RUNNING
        assert observation.error is not None and observation.error.code == "AMBIGUOUS_OUTCOME"
        assert "provider response" not in observation.error.message
        assert len(await journal.recoverable()) == 1
        replay = await runtime.submit(compute_task)
        assert replay.state == ExecutionState.RUNNING
        assert executor.calls == 1
    finally:
        await runtime.stop()


async def test_expired_unknown_is_not_false_failed_or_canceled_and_keeps_capacity(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    await journal.initialize()
    await journal.save_accepted(compute_task)
    await journal.mark_submitting(compute_task.task_id, compute_task.attempt_id)
    await journal.request_cancel(compute_task.task_id, compute_task.attempt_id)
    clock = compute_task.constraints.deadline + timedelta(hours=1)
    executor = FakeExecutor()
    runtime = ExecutionApplicationService(
        journal, ExecutorCatalog((executor,)), 1, now_fn=lambda: clock
    )
    await runtime.start()
    try:
        observation = await runtime.get(compute_task.task_id, compute_task.attempt_id)
        assert observation is not None and observation.state == ExecutionState.RUNNING
        assert (
            await journal.load_submission_state(compute_task.task_id, compute_task.attempt_id)
            == SubmissionState.UNKNOWN
        )
        assert executor.calls == 0
        other = compute_task.model_copy(deep=True)
        other.task_id, other.attempt_id = uuid4(), uuid4()
        other.idempotency_key = str(uuid4())
        other.constraints.deadline = clock + timedelta(hours=1)
        other.request_fingerprint = request_fingerprint(other)
        with pytest.raises(CapacityError):
            await runtime.submit(other)
    finally:
        await runtime.stop()


class ResumeOnlyExecutor(FakeExecutor):
    def __init__(self) -> None:
        super().__init__()
        self.submits = 0
        self.resumes = 0

    async def execute(
        self, task: ComputeTask, cancel: asyncio.Event, context: ExecutionContext | None = None
    ) -> ExecutionOutput:
        assert context is not None
        if context.existing_execution_handle:
            self.resumes += 1
            return ExecutionOutput(execution_handle=context.existing_execution_handle)
        self.submits += 1
        assert context.save_submitting is not None and context.save_handle is not None
        await context.save_submitting()
        await context.save_handle("opaque-handle")
        await asyncio.Event().wait()
        return ExecutionOutput()


async def test_timeout_with_handle_can_finish_by_polling_without_a_second_submit(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    compute_task.constraints.max_runtime_seconds = 1
    compute_task.constraints.deadline = datetime.now(UTC) + timedelta(hours=1)
    compute_task.request_fingerprint = request_fingerprint(compute_task)
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    executor = ResumeOnlyExecutor()
    runtime = ExecutionApplicationService(journal, ExecutorCatalog((executor,)), 1)
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        await wait_unknown(runtime, compute_task)
        async with asyncio.timeout(5):
            while True:
                observation = await runtime.get(compute_task.task_id, compute_task.attempt_id)
                if observation is not None and observation.state == ExecutionState.SUCCEEDED:
                    break
                await asyncio.sleep(0.01)
        assert executor.submits == 1
        assert executor.resumes == 1
    finally:
        await runtime.stop()
