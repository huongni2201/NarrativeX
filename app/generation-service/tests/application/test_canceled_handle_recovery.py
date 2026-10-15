from __future__ import annotations

import asyncio
from pathlib import Path

from conftest import FakeExecutor
from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)
from narrativex_gpu_worker.application.ports.execution import ExecutionOutput
from narrativex_gpu_worker.application.services.execution import ExecutionApplicationService
from narrativex_gpu_worker.contracts import ComputeTask, ExecutionState, ProducedArtifact


class ReadOnlyRecoveryExecutor(FakeExecutor):
    async def execute(self, task, cancel, context=None):
        self.calls += 1
        assert context.existing_execution_handle == "existing-handle"
        # Reconciliation reads the outcome; no submit callbacks may be used.
        assert not cancel.is_set()
        return ExecutionOutput(
            execution_handle="existing-handle",
            outputs=[
                ProducedArtifact(
                    artifact_id=task.task_id,
                    role="audio",
                    media_type="audio/wav",
                    size_bytes=16,
                    sha256="0" * 64,
                )
            ],
        )


async def test_canceled_known_handle_reconciles_without_resubmission(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "cancel-recovery.sqlite3")
    await journal.initialize()
    await journal.save_accepted(compute_task)
    await journal.mark_submitted(compute_task.task_id, compute_task.attempt_id, "existing-handle")
    await journal.request_cancel(compute_task.task_id, compute_task.attempt_id)
    executor = ReadOnlyRecoveryExecutor()
    runtime = ExecutionApplicationService(journal, ExecutorCatalog((executor,)), 1)
    await runtime.start()
    try:
        async with asyncio.timeout(2):
            while True:
                observation = await runtime.get(compute_task.task_id, compute_task.attempt_id)
                if observation and observation.state == ExecutionState.CANCELED:
                    assert not observation.outputs
                    break
                await asyncio.sleep(0.01)
        assert executor.calls == 1
        assert not await journal.recoverable()
    finally:
        await runtime.stop()
