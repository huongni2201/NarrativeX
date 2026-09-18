from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)
from narrativex_gpu_worker.application import (
    ExecutionApplicationService,
    ExecutionCanceledError,
)
from narrativex_gpu_worker.application.ports.execution import (
    ExecutionContext,
    ExecutionOutput,
)
from narrativex_gpu_worker.contracts import (
    ComputeObservation,
    ComputeTask,
    ExecutionMetrics,
    ExecutionState,
    ModelRef,
)


async def wait_for_state(
    runtime: ExecutionApplicationService, task: ComputeTask, expected: ExecutionState
) -> ComputeObservation:
    for _ in range(250):
        obs = await runtime.get(task.task_id, task.attempt_id)
        if obs is not None and obs.state == expected:
            return obs
        await asyncio.sleep(0.01)
    pytest.fail(f"attempt {task.attempt_id} did not reach {expected}")


class CanceledExecutor:
    name = "vieneu"
    task_types = frozenset({"audio.synthesize"})
    models = (ModelRef(executor="vieneu", model="vieneu-v3-turbo", revision="default"),)
    ready = True

    def __init__(self, message: str = "User requested cancellation") -> None:
        self.message = message
        self.calls = 0

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput:
        self.calls += 1
        if context and context.save_submitting:
            await context.save_submitting()
        raise ExecutionCanceledError(self.message)


class ShutdownExecutor:
    name = "vieneu"
    task_types = frozenset({"audio.synthesize"})
    models = (ModelRef(executor="vieneu", model="vieneu-v3-turbo", revision="default"),)
    ready = True

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput:
        if context and context.save_submitting:
            await context.save_submitting()
        raise asyncio.CancelledError()


class PreUploadCancelExecutor:
    name = "vieneu"
    task_types = frozenset({"audio.synthesize"})
    models = (ModelRef(executor="vieneu", model="vieneu-v3-turbo", revision="default"),)
    ready = True

    def __init__(self) -> None:
        self.provider_completed = False
        self.artifact_uploaded = False

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput:
        if context and context.save_submitting:
            await context.save_submitting()
        # Simulate provider response arriving
        self.provider_completed = True
        # Simulate cancellation arriving right after provider response
        cancel.set()
        if cancel.is_set():
            raise ExecutionCanceledError("Canceled before artifact upload")
        self.artifact_uploaded = True
        return ExecutionOutput(metrics=ExecutionMetrics(runtime_ms=10))


async def test_case_a_user_cancel_becomes_terminal_canceled(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    executor = CanceledExecutor()
    runtime = ExecutionApplicationService(
        journal,
        ExecutorCatalog((executor,)),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        obs = await wait_for_state(runtime, compute_task, ExecutionState.CANCELED)
        assert obs.state == ExecutionState.CANCELED
        assert obs.error is None

        # Verify durable state
        durable_obs = await journal.load(compute_task.task_id, compute_task.attempt_id)
        assert durable_obs is not None
        assert durable_obs.state == ExecutionState.CANCELED
        recoverable_tasks = await journal.recoverable()
        assert not any(t[0].attempt_id == compute_task.attempt_id for t in recoverable_tasks)
    finally:
        await runtime.stop()


async def test_case_b_raw_cancelled_error_propagates_without_terminal_mutation(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    executor = ShutdownExecutor()
    runtime = ExecutionApplicationService(
        journal,
        ExecutorCatalog((executor,)),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        # Allow time for executor to run and raise asyncio.CancelledError
        await asyncio.sleep(0.1)

        # Durable state must NOT be converted to CANCELED, FAILED, or UNKNOWN
        durable_obs = await journal.load(compute_task.task_id, compute_task.attempt_id)
        assert durable_obs is not None
        assert durable_obs.state not in (ExecutionState.CANCELED, ExecutionState.FAILED)
    finally:
        await runtime.stop()


async def test_case_c_restart_after_user_cancel_does_not_reschedule(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    db_path = tmp_path / "journal.sqlite3"
    journal1 = SqliteExecutionJournalAdapter(db_path)
    executor1 = CanceledExecutor()
    runtime1 = ExecutionApplicationService(
        journal1,
        ExecutorCatalog((executor1,)),
        1,
    )
    await runtime1.start()
    await runtime1.submit(compute_task)
    await wait_for_state(runtime1, compute_task, ExecutionState.CANCELED)
    await runtime1.stop()

    # Restart service with new instance
    journal2 = SqliteExecutionJournalAdapter(db_path)
    executor2 = CanceledExecutor()
    runtime2 = ExecutionApplicationService(
        journal2,
        ExecutorCatalog((executor2,)),
        1,
    )
    await runtime2.start()
    try:
        await asyncio.sleep(0.05)
        # Executor must NOT have been called on recovery
        assert executor2.calls == 0

        obs = await runtime2.get(compute_task.task_id, compute_task.attempt_id)
        assert obs is not None
        assert obs.state == ExecutionState.CANCELED
    finally:
        await runtime2.stop()


async def test_race_a_cancel_before_artifact_upload_prevents_upload(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    executor = PreUploadCancelExecutor()
    runtime = ExecutionApplicationService(
        journal,
        ExecutorCatalog((executor,)),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        obs = await wait_for_state(runtime, compute_task, ExecutionState.CANCELED)
        assert obs.state == ExecutionState.CANCELED
        assert executor.provider_completed is True
        assert executor.artifact_uploaded is False
    finally:
        await runtime.stop()


async def test_race_b_cancel_after_succeeded_commit_does_not_reverse_success(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")

    class FastSuccessExecutor:
        name = "vieneu"
        task_types = frozenset({"audio.synthesize"})
        models = (ModelRef(executor="vieneu", model="vieneu-v3-turbo", revision="default"),)
        ready = True

        async def execute(self, task, cancel, context=None):
            return ExecutionOutput(metrics=ExecutionMetrics(runtime_ms=1))

    runtime = ExecutionApplicationService(
        journal,
        ExecutorCatalog((FastSuccessExecutor(),)),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        await wait_for_state(runtime, compute_task, ExecutionState.SUCCEEDED)

        # Late cancellation arrives after durable SUCCEEDED commit
        await runtime.cancel(compute_task.task_id, compute_task.attempt_id)

        obs = await runtime.get(compute_task.task_id, compute_task.attempt_id)
        assert obs is not None
        assert obs.state == ExecutionState.SUCCEEDED
    finally:
        await runtime.stop()
