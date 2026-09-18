from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest

from conftest import FakeExecutor
from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)
from narrativex_gpu_worker.application import (
    CapacityError,
    DeadlineExceededError,
    ExecutionApplicationService,
)
from narrativex_gpu_worker.application.ports.execution import (
    ExecutionContext,
    ExecutionOutput,
    ExecutorPort,
)
from narrativex_gpu_worker.contracts import (
    ComputeObservation,
    ComputeTask,
    ErrorCategory,
    ExecutionMetrics,
    ExecutionState,
    ModelRef,
    request_fingerprint,
)
from narrativex_gpu_worker.domain.submission import SubmissionState


async def wait_for_state(
    runtime: ExecutionApplicationService, task: ComputeTask, expected: ExecutionState
) -> None:
    for _ in range(250):
        observation = await runtime.get(task.task_id, task.attempt_id)
        if observation is not None and observation.state == expected:
            return
        await asyncio.sleep(0.01)
    pytest.fail(f"attempt did not reach {expected}")


async def test_runtime_executes_and_replays_once(tmp_path: Path, compute_task: ComputeTask) -> None:
    executor = FakeExecutor()
    runtime = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3"),
        ExecutorCatalog(
            (executor,),
        ),
        1,
    )
    await runtime.start()
    try:
        accepted = await runtime.submit(compute_task)
        assert accepted.state == ExecutionState.ACCEPTED
        await wait_for_state(runtime, compute_task, ExecutionState.SUCCEEDED)
        replay = await runtime.submit(compute_task)
        assert replay.state == ExecutionState.SUCCEEDED
        assert executor.calls == 1
    finally:
        await runtime.stop()


async def test_runtime_replays_without_requiring_provider_readiness(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    executor = FakeExecutor()
    runtime = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3"),
        ExecutorCatalog(
            (executor,),
        ),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        await wait_for_state(runtime, compute_task, ExecutionState.SUCCEEDED)
        executor.ready = False

        replay = await runtime.submit(compute_task)

        assert replay.state == ExecutionState.SUCCEEDED
        assert executor.calls == 1
    finally:
        await runtime.stop()


async def test_runtime_rejects_new_work_at_capacity(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    gate = asyncio.Event()
    runtime = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3"),
        ExecutorCatalog(
            (FakeExecutor(gate),),
        ),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        second = deepcopy(compute_task)
        second.task_id = uuid4()
        second.attempt_id = uuid4()
        second.idempotency_key = f"compute:{second.task_id}:1"
        second.request_fingerprint = request_fingerprint(second)
        with pytest.raises(CapacityError):
            await runtime.submit(second)
    finally:
        gate.set()
        await runtime.stop()


async def test_runtime_rejects_expired_task_before_accepted(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    compute_task.constraints.deadline = datetime.now(UTC) - timedelta(minutes=1)
    compute_task.request_fingerprint = request_fingerprint(compute_task)

    runtime = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3"),
        ExecutorCatalog(
            (FakeExecutor(),),
        ),
        1,
    )
    await runtime.start()
    try:
        with pytest.raises(DeadlineExceededError):
            await runtime.submit(compute_task)
    finally:
        await runtime.stop()


async def test_runtime_recovers_nonterminal_attempt_after_restart(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    database_file = tmp_path / "journal.sqlite3"
    gate = asyncio.Event()
    first = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(database_file),
        ExecutorCatalog(
            (FakeExecutor(gate),),
        ),
        1,
    )
    await first.start()
    await first.submit(compute_task)
    await wait_for_state(first, compute_task, ExecutionState.RUNNING)
    await first.stop()

    executor = FakeExecutor()
    second = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(database_file),
        ExecutorCatalog(
            (executor,),
        ),
        1,
    )
    await second.start()
    try:
        await wait_for_state(second, compute_task, ExecutionState.SUCCEEDED)
        assert executor.calls == 1
    finally:
        await second.stop()


async def test_runtime_marks_expired_task_failed_on_recovery(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    database_file = tmp_path / "journal.sqlite3"
    journal = SqliteExecutionJournalAdapter(database_file)
    await journal.initialize()

    # Seed an attempt with a deadline already in the past
    compute_task.constraints.deadline = datetime.now(UTC) - timedelta(seconds=10)
    compute_task.request_fingerprint = request_fingerprint(compute_task)
    await journal.save_accepted(compute_task)

    running_obs = ComputeObservation(
        task_id=compute_task.task_id,
        attempt_id=compute_task.attempt_id,
        state=ExecutionState.RUNNING,
        sequence=1,
        observed_at=datetime.now(UTC) - timedelta(seconds=10),
    )
    await journal.update(running_obs)

    executor = FakeExecutor()
    service = ExecutionApplicationService(
        journal,
        ExecutorCatalog(
            (executor,),
        ),
        1,
    )
    await service.start()
    try:
        obs = await service.get(compute_task.task_id, compute_task.attempt_id)
        assert obs is not None
        assert obs.state == ExecutionState.FAILED
        assert obs.error is not None
        assert obs.error.code == "DEADLINE_EXCEEDED"
        assert obs.error.category == ErrorCategory.PERMANENT
        assert executor.calls == 0
    finally:
        await service.stop()


async def test_runtime_persists_cancellation_across_restart(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    database_file = tmp_path / "journal.sqlite3"
    gate = asyncio.Event()
    first = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(database_file),
        ExecutorCatalog(
            (FakeExecutor(gate),),
        ),
        1,
    )
    await first.start()
    await first.submit(compute_task)
    await wait_for_state(first, compute_task, ExecutionState.RUNNING)

    # Cancel while running
    await first.cancel(compute_task.task_id, compute_task.attempt_id)
    # Stop before completion
    await first.stop()

    # Restart
    executor = FakeExecutor()
    second = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(database_file),
        ExecutorCatalog(
            (executor,),
        ),
        1,
    )
    await second.start()
    try:
        obs = await second.get(compute_task.task_id, compute_task.attempt_id)
        assert obs is not None
        assert obs.state == ExecutionState.CANCELED
        assert executor.calls == 0
    finally:
        await second.stop()


async def test_runtime_maps_executor_crash_to_safe_failure(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    runtime = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3"),
        ExecutorCatalog(
            (FakeExecutor(failure=RuntimeError("secret provider body")),),
        ),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        await wait_for_state(runtime, compute_task, ExecutionState.FAILED)
        failed = await runtime.get(compute_task.task_id, compute_task.attempt_id)
        assert failed is not None and failed.error is not None
        assert failed.error.message == "Executor failed safely"
    finally:
        await runtime.stop()


async def test_runtime_cancels_cooperatively(tmp_path: Path, compute_task: ComputeTask) -> None:
    runtime = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3"),
        ExecutorCatalog(
            (FakeExecutor(asyncio.Event()),),
        ),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        await wait_for_state(runtime, compute_task, ExecutionState.RUNNING)
        await runtime.cancel(compute_task.task_id, compute_task.attempt_id)
        await wait_for_state(runtime, compute_task, ExecutionState.CANCELED)
    finally:
        await runtime.stop()


async def test_runtime_bounds_executor_runtime_timeout(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    # max_runtime_seconds = 1, deadline is far in the future
    compute_task.constraints.max_runtime_seconds = 1
    compute_task.constraints.deadline = datetime.now(UTC) + timedelta(hours=1)
    compute_task.request_fingerprint = request_fingerprint(compute_task)

    runtime = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3"),
        ExecutorCatalog(
            (FakeExecutor(asyncio.Event()),),
        ),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        await wait_for_state(runtime, compute_task, ExecutionState.FAILED)
        failed = await runtime.get(compute_task.task_id, compute_task.attempt_id)
        assert failed is not None and failed.error is not None
        assert failed.error.code == "EXECUTION_TIMEOUT"
        assert failed.error.category == ErrorCategory.TRANSIENT
    finally:
        await runtime.stop()


async def test_runtime_bounds_executor_deadline_exceeded(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    # deadline is short (0.2s), max_runtime_seconds is large (100s)
    compute_task.constraints.deadline = datetime.now(UTC) + timedelta(milliseconds=200)
    compute_task.constraints.max_runtime_seconds = 100
    compute_task.request_fingerprint = request_fingerprint(compute_task)

    runtime = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3"),
        ExecutorCatalog(
            (FakeExecutor(asyncio.Event()),),
        ),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        await wait_for_state(runtime, compute_task, ExecutionState.FAILED)
        failed = await runtime.get(compute_task.task_id, compute_task.attempt_id)
        assert failed is not None and failed.error is not None
        assert failed.error.code == "DEADLINE_EXCEEDED"
        assert failed.error.category == ErrorCategory.PERMANENT
    finally:
        await runtime.stop()


class StatefulHandleExecutor(ExecutorPort):
    name = "vieneu"
    task_types = frozenset({"audio.synthesize"})
    models = (ModelRef(executor="vieneu", model="vieneu-v3-turbo", revision="default"),)
    ready = True

    def __init__(self) -> None:
        self.received_existing_handle: str | None = None
        self.gate = asyncio.Event()

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput:
        if context:
            self.received_existing_handle = context.existing_execution_handle
            if context.save_handle:
                await context.save_handle("handle-12345")
        while not self.gate.is_set() and not cancel.is_set():
            await asyncio.sleep(0.01)
        return ExecutionOutput(
            metrics=ExecutionMetrics(runtime_ms=1), execution_handle="handle-12345"
        )


async def test_runtime_persists_and_restores_execution_handle(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    database_file = tmp_path / "journal.sqlite3"
    first_executor = StatefulHandleExecutor()
    first = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(database_file),
        ExecutorCatalog(
            (first_executor,),
        ),
        1,
    )
    await first.start()
    await first.submit(compute_task)
    await wait_for_state(first, compute_task, ExecutionState.RUNNING)

    # Wait until handle is saved
    for _ in range(100):
        obs = await first.get(compute_task.task_id, compute_task.attempt_id)
        if obs and obs.execution_handle == "handle-12345":
            break
        await asyncio.sleep(0.01)
    await first.stop()

    # Second runtime restart
    second_executor = StatefulHandleExecutor()
    second = ExecutionApplicationService(
        SqliteExecutionJournalAdapter(database_file),
        ExecutorCatalog(
            (second_executor,),
        ),
        1,
    )
    await second.start()
    try:
        for _ in range(100):
            if second_executor.received_existing_handle is not None:
                break
            await asyncio.sleep(0.01)
        assert second_executor.received_existing_handle == "handle-12345"
        second_executor.gate.set()
        await wait_for_state(second, compute_task, ExecutionState.SUCCEEDED)
    finally:
        await second.stop()


async def test_recovery_does_not_blind_resubmit_ambiguous_attempt(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    await journal.initialize()
    await journal.save_accepted(compute_task)
    # Mark as SUBMITTING (crash after intent before handle)
    await journal.mark_submitting(compute_task.task_id, compute_task.attempt_id)

    class CountingExecutor:
        name = "vieneu"
        task_types = frozenset({"audio.synthesize"})
        models = (ModelRef(executor="vieneu", model="vieneu-v3-turbo", revision="default"),)
        ready = True
        execute_count = 0

        async def execute(self, task, cancel, context=None):
            self.execute_count += 1
            return ExecutionOutput()

    counting_executor = CountingExecutor()
    runtime = ExecutionApplicationService(
        journal,
        ExecutorCatalog((counting_executor,)),
        1,
    )
    await runtime.start()
    try:
        # Give event loop a cycle
        await asyncio.sleep(0.05)
        # Verify executor was NEVER called!
        assert counting_executor.execute_count == 0
        # Verify state is held as UNKNOWN
        assert (
            await journal.load_submission_state(compute_task.task_id, compute_task.attempt_id)
            == SubmissionState.UNKNOWN
        )
    finally:
        await runtime.stop()


async def test_recovery_does_not_false_cancel_ambiguous_attempt(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    await journal.initialize()
    await journal.save_accepted(compute_task)
    await journal.mark_unknown(compute_task.task_id, compute_task.attempt_id)
    await journal.request_cancel(compute_task.task_id, compute_task.attempt_id)

    runtime = ExecutionApplicationService(
        journal,
        ExecutorCatalog((FakeExecutor(asyncio.Event()),)),
        1,
    )
    await runtime.start()
    try:
        obs = await journal.load(compute_task.task_id, compute_task.attempt_id)
        assert obs is not None
        # Must NOT confirm false cancellation to avoid releasing backend retry!
        assert obs.state != ExecutionState.CANCELED
        assert (
            await journal.load_submission_state(compute_task.task_id, compute_task.attempt_id)
            == SubmissionState.UNKNOWN
        )
    finally:
        await runtime.stop()


async def test_timeout_after_dispatch_is_ambiguous_permanent(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    compute_task.constraints.max_runtime_seconds = 1
    compute_task.constraints.deadline = datetime.now(UTC) + timedelta(hours=1)
    compute_task.request_fingerprint = request_fingerprint(compute_task)

    class SubmittingThenHangingExecutor:
        name = "vieneu"
        task_types = frozenset({"audio.synthesize"})
        models = (ModelRef(executor="vieneu", model="vieneu-v3-turbo", revision="default"),)
        ready = True

        async def execute(self, task, cancel, context=None):
            if context and context.save_submitting:
                await context.save_submitting()
            # Hang until timeout
            await asyncio.Event().wait()
            return ExecutionOutput()

    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    runtime = ExecutionApplicationService(
        journal,
        ExecutorCatalog((SubmittingThenHangingExecutor(),)),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        await wait_for_state(runtime, compute_task, ExecutionState.FAILED)
        failed = await runtime.get(compute_task.task_id, compute_task.attempt_id)
        assert failed is not None and failed.error is not None
        assert failed.error.code == "EXECUTION_TIMEOUT"
        assert failed.error.category == ErrorCategory.PERMANENT
        assert (
            await journal.load_submission_state(compute_task.task_id, compute_task.attempt_id)
            == SubmissionState.UNKNOWN
        )
    finally:
        await runtime.stop()

