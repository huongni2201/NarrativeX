from __future__ import annotations

import asyncio
from copy import deepcopy
from pathlib import Path
from uuid import uuid4

import pytest

from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)
from narrativex_gpu_worker.adapters.runtime.manager import GpuResidencyManager
from narrativex_gpu_worker.application.errors import ResidencyTransitionError
from narrativex_gpu_worker.application.ports.execution import (
    ExecutionContext,
    ExecutionOutput,
)
from narrativex_gpu_worker.application.ports.residency import (
    RuntimeFamily,
    RuntimeRequirement,
)
from narrativex_gpu_worker.application.services import ExecutionApplicationService
from narrativex_gpu_worker.contracts import (
    ComputeTask,
    ExecutionMetrics,
    ExecutionState,
    ModelRef,
    request_fingerprint,
)


async def test_residency_exclusive_family_switch() -> None:
    events: list[str] = []

    async def unload_comfyui() -> None:
        events.append("unload:comfyui")

    async def load_whisperx() -> None:
        events.append("load:whisperx")

    manager = GpuResidencyManager(
        transition_timeout_seconds=5.0,
        unload_hooks={RuntimeFamily.COMFYUI_VIDEO: unload_comfyui},
        load_hooks={RuntimeFamily.WHISPERX: load_whisperx},
    )

    req_comfy = RuntimeRequirement(family=RuntimeFamily.COMFYUI_VIDEO, exclusive=True)
    req_whisperx = RuntimeRequirement(family=RuntimeFamily.WHISPERX, exclusive=True)

    # Acquire ComfyUI lease
    async with manager.acquire(req_comfy):
        assert manager.current_family == RuntimeFamily.COMFYUI_VIDEO
        assert manager.active_leases == 1

    assert manager.active_leases == 0
    assert manager.current_family == RuntimeFamily.COMFYUI_VIDEO

    # Acquire WhisperX lease (should trigger unload comfyui -> load whisperx)
    async with manager.acquire(req_whisperx):
        assert manager.current_family == RuntimeFamily.WHISPERX
        assert manager.active_leases == 1

    assert events == ["unload:comfyui", "load:whisperx"]


async def test_residency_concurrent_non_exclusive_leases() -> None:
    manager = GpuResidencyManager(transition_timeout_seconds=5.0)
    req_voice = RuntimeRequirement(family=RuntimeFamily.VIENEU, exclusive=False)

    lease1_held = asyncio.Event()
    lease2_held = asyncio.Event()
    finish = asyncio.Event()

    async def holder1() -> None:
        async with manager.acquire(req_voice):
            lease1_held.set()
            await finish.wait()

    async def holder2() -> None:
        async with manager.acquire(req_voice):
            lease2_held.set()
            await finish.wait()

    t1 = asyncio.create_task(holder1())
    t2 = asyncio.create_task(holder2())

    await lease1_held.wait()
    await lease2_held.wait()
    assert manager.current_family == RuntimeFamily.VIENEU
    assert manager.active_leases == 2

    finish.set()
    await asyncio.gather(t1, t2)
    assert manager.active_leases == 0


async def test_residency_exclusive_blocks_concurrent() -> None:
    manager = GpuResidencyManager(transition_timeout_seconds=5.0)
    req_exclusive = RuntimeRequirement(family=RuntimeFamily.COMFYUI_VIDEO, exclusive=True)

    entered_first = asyncio.Event()
    release_first = asyncio.Event()
    entered_second = asyncio.Event()

    async def task1() -> None:
        async with manager.acquire(req_exclusive):
            entered_first.set()
            await release_first.wait()

    async def task2() -> None:
        await entered_first.wait()
        async with manager.acquire(req_exclusive):
            entered_second.set()

    t1 = asyncio.create_task(task1())
    t2 = asyncio.create_task(task2())

    await entered_first.wait()
    assert not entered_second.is_set()

    await asyncio.sleep(0.05)
    assert not entered_second.is_set()

    release_first.set()
    await entered_second.wait()
    await asyncio.gather(t1, t2)


async def test_residency_transition_timeout_fails_closed() -> None:
    async def hanging_unloader() -> None:
        await asyncio.sleep(10.0)

    manager = GpuResidencyManager(
        transition_timeout_seconds=0.1,
        unload_hooks={RuntimeFamily.COMFYUI_VIDEO: hanging_unloader},
    )

    # First establish COMFYUI_VIDEO
    req_video = RuntimeRequirement(family=RuntimeFamily.COMFYUI_VIDEO, exclusive=True)
    async with manager.acquire(req_video):
        pass

    # Next attempt to switch to WHISPERX; unloader will hang and exceed 0.1s timeout
    req_whisperx = RuntimeRequirement(family=RuntimeFamily.WHISPERX, exclusive=True)
    with pytest.raises(ResidencyTransitionError, match="timed out"):
        async with manager.acquire(req_whisperx):
            pass

    # Manager must now be poisoned and fail-closed
    assert manager.is_poisoned
    req_voice = RuntimeRequirement(family=RuntimeFamily.VIENEU, exclusive=False)
    with pytest.raises(ResidencyTransitionError, match="poisoned"):
        async with manager.acquire(req_voice):
            pass

    # release_all resets the poisoned state
    await manager.release_all()
    assert not manager.is_poisoned
    assert manager.current_family == RuntimeFamily.NONE


class FamilyExecutor:
    def __init__(self, name: str, family: RuntimeFamily, exclusive: bool = True) -> None:
        self.name = name
        self.task_types = frozenset({"audio.synthesize"})
        self.models = (ModelRef(executor=name, model="default", revision="1.0"),)
        self.ready = True
        self.calls = 0
        self.runtime_requirement = RuntimeRequirement(family=family, exclusive=exclusive)

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput:
        self.calls += 1
        return ExecutionOutput(metrics=ExecutionMetrics(runtime_ms=5))


async def test_execution_service_with_residency(tmp_path: Path, compute_task: ComputeTask) -> None:
    exec_a = FamilyExecutor("exec-a", RuntimeFamily.COMFYUI_VIDEO, exclusive=True)
    exec_b = FamilyExecutor("exec-b", RuntimeFamily.WHISPERX, exclusive=True)

    catalog = ExecutorCatalog((exec_a, exec_b))
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    residency = GpuResidencyManager(transition_timeout_seconds=5.0)

    service = ExecutionApplicationService(
        journal=journal,
        executor_catalog=catalog,
        max_concurrency=2,
        residency=residency,
    )

    await service.start()
    try:
        # Submit Task A
        task_a = deepcopy(compute_task)
        task_a.model = ModelRef(executor="exec-a", model="default", revision="1.0")
        task_a.request_fingerprint = request_fingerprint(task_a)

        obs_a = await service.submit(task_a)
        assert obs_a.state == ExecutionState.ACCEPTED

        res = None
        for _ in range(100):
            res = await service.get(task_a.task_id, task_a.attempt_id)
            if res and res.state == ExecutionState.SUCCEEDED:
                break
            await asyncio.sleep(0.01)
        assert res is not None and res.state == ExecutionState.SUCCEEDED
        assert residency.current_family == RuntimeFamily.COMFYUI_VIDEO

        # Submit Task B (requires transition to WHISPERX)
        task_b = deepcopy(compute_task)
        task_b.task_id = uuid4()
        task_b.attempt_id = uuid4()
        task_b.model = ModelRef(executor="exec-b", model="default", revision="1.0")
        task_b.idempotency_key = f"compute:{task_b.task_id}:1"
        task_b.request_fingerprint = request_fingerprint(task_b)

        obs_b = await service.submit(task_b)
        assert obs_b.state == ExecutionState.ACCEPTED

        res_b = None
        for _ in range(100):
            res_b = await service.get(task_b.task_id, task_b.attempt_id)
            if res_b and res_b.state == ExecutionState.SUCCEEDED:
                break
            await asyncio.sleep(0.01)
        assert res_b is not None and res_b.state == ExecutionState.SUCCEEDED
        assert residency.current_family == RuntimeFamily.WHISPERX
        assert exec_a.calls == 1
        assert exec_b.calls == 1
    finally:
        await service.stop()
        await residency.release_all()
