from __future__ import annotations

import asyncio
from copy import deepcopy
from pathlib import Path
from uuid import uuid4

import pytest

from conftest import FakeExecutor
from narrativex_gpu_worker.domain.models import ComputeTask, ExecutionState
from narrativex_gpu_worker.executors import ExecutorRegistry
from narrativex_gpu_worker.runtime import CapacityError, ExecutionJournal, TaskRuntime


async def wait_for_state(runtime: TaskRuntime, task: ComputeTask, expected: ExecutionState) -> None:
    for _ in range(250):
        observation = await runtime.get(task.task_id, task.attempt_id)
        if observation is not None and observation.state == expected:
            return
        await asyncio.sleep(0.01)
    pytest.fail(f"attempt did not reach {expected}")


async def test_runtime_executes_and_replays_once(tmp_path: Path, compute_task: ComputeTask) -> None:
    executor = FakeExecutor()
    runtime = TaskRuntime(
        ExecutionJournal(tmp_path / "journal.sqlite3"),
        ExecutorRegistry((executor,)),
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


async def test_runtime_rejects_new_work_at_capacity(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    gate = asyncio.Event()
    runtime = TaskRuntime(
        ExecutionJournal(tmp_path / "journal.sqlite3"),
        ExecutorRegistry((FakeExecutor(gate),)),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        second = deepcopy(compute_task)
        second.task_id = uuid4()
        second.attempt_id = uuid4()
        second.idempotency_key = f"compute:{second.task_id}:1"
        second.request_fingerprint = "e" * 64
        with pytest.raises(CapacityError):
            await runtime.submit(second)
    finally:
        gate.set()
        await runtime.stop()


async def test_runtime_recovers_nonterminal_attempt_after_restart(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    database_file = tmp_path / "journal.sqlite3"
    gate = asyncio.Event()
    first = TaskRuntime(ExecutionJournal(database_file), ExecutorRegistry((FakeExecutor(gate),)), 1)
    await first.start()
    await first.submit(compute_task)
    await wait_for_state(first, compute_task, ExecutionState.RUNNING)
    await first.stop()

    executor = FakeExecutor()
    second = TaskRuntime(ExecutionJournal(database_file), ExecutorRegistry((executor,)), 1)
    await second.start()
    try:
        await wait_for_state(second, compute_task, ExecutionState.SUCCEEDED)
        assert executor.calls == 1
    finally:
        await second.stop()


async def test_runtime_maps_executor_crash_to_safe_failure(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    runtime = TaskRuntime(
        ExecutionJournal(tmp_path / "journal.sqlite3"),
        ExecutorRegistry((FakeExecutor(failure=RuntimeError("secret provider body")),)),
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
    runtime = TaskRuntime(
        ExecutionJournal(tmp_path / "journal.sqlite3"),
        ExecutorRegistry((FakeExecutor(asyncio.Event()),)),
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


async def test_runtime_bounds_executor_duration(tmp_path: Path, compute_task: ComputeTask) -> None:
    compute_task.constraints.max_runtime_seconds = 1
    runtime = TaskRuntime(
        ExecutionJournal(tmp_path / "journal.sqlite3"),
        ExecutorRegistry((FakeExecutor(asyncio.Event()),)),
        1,
    )
    await runtime.start()
    try:
        await runtime.submit(compute_task)
        await wait_for_state(runtime, compute_task, ExecutionState.FAILED)
        failed = await runtime.get(compute_task.task_id, compute_task.attempt_id)
        assert failed is not None and failed.error is not None
        assert failed.error.code == "EXECUTION_UNAVAILABLE"
    finally:
        await runtime.stop()
