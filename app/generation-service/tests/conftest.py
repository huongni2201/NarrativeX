from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import pytest

from narrativex_gpu_worker.application.ports.execution import ExecutionOutput
from narrativex_gpu_worker.contracts import ComputeTask, ExecutionMetrics, ModelRef

ROOT = Path(__file__).resolve().parents[3]


def task_payload() -> dict[str, Any]:
    source = ROOT / "contracts" / "compute" / "v1" / "examples" / "audio-synthesize-task.json"
    return json.loads(source.read_text(encoding="utf-8"))


@pytest.fixture
def compute_task() -> ComputeTask:
    return ComputeTask.model_validate(task_payload())


class FakeExecutor:
    name = "voicestudio"
    task_types = frozenset({"audio.synthesize"})
    models = (ModelRef(executor="voicestudio", model="vi-profile", revision="0.5.2"),)
    ready = True

    def __init__(self, gate: asyncio.Event | None = None, failure: Exception | None = None) -> None:
        self.gate = gate
        self.failure = failure
        self.calls = 0

    async def execute(self, task: ComputeTask, cancel: asyncio.Event) -> ExecutionOutput:
        self.calls += 1
        if self.gate is not None:
            while not self.gate.is_set() and not cancel.is_set():
                await asyncio.sleep(0)
        if self.failure is not None:
            raise self.failure
        return ExecutionOutput(
            metrics=ExecutionMetrics(runtimeMs=1), execution_handle="opaque-test-handle"
        )


@pytest.fixture
def fake_executor() -> FakeExecutor:
    return FakeExecutor()
