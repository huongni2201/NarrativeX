from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

import pytest

from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)
from narrativex_gpu_worker.contracts import ComputeObservation, ComputeTask, ExecutionState


async def test_journal_replays_identical_attempt(tmp_path: Path, compute_task: ComputeTask) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    await journal.initialize()

    first, created = await journal.save_accepted(compute_task)
    replay = await journal.replay(compute_task)

    assert created is True
    assert replay == first


async def test_journal_rejects_fingerprint_conflict(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    await journal.initialize()
    await journal.save_accepted(compute_task)
    changed = deepcopy(compute_task)
    changed.request_fingerprint = "f" * 64

    with pytest.raises(ValueError, match="fingerprint conflict"):
        await journal.replay(changed)


async def test_journal_ignores_duplicate_or_older_sequence(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    await journal.initialize()
    await journal.save_accepted(compute_task)
    running = ComputeObservation(
        task_id=compute_task.task_id,
        attempt_id=compute_task.attempt_id,
        state=ExecutionState.RUNNING,
        sequence=2,
        observed_at=datetime.now(UTC),
    )
    await journal.update(running)
    older = running.model_copy(update={"state": ExecutionState.ACCEPTED, "sequence": 1})
    await journal.update(older)
    assert await journal.load(compute_task.task_id, compute_task.attempt_id) == running
