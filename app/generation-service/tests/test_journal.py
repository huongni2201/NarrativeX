from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

import pytest

from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)
from narrativex_gpu_worker.contracts import ComputeObservation, ComputeTask, ExecutionState
from narrativex_gpu_worker.domain.submission import SubmissionState


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


async def test_journal_persists_cancellation_request(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    await journal.initialize()
    await journal.save_accepted(compute_task)

    assert await journal.is_cancel_requested(compute_task.task_id, compute_task.attempt_id) is False
    changed = await journal.request_cancel(compute_task.task_id, compute_task.attempt_id)
    assert changed is True
    assert await journal.is_cancel_requested(compute_task.task_id, compute_task.attempt_id) is True

    # recoverable reports cancel_requested = True
    recoverable = await journal.recoverable()
    assert len(recoverable) == 1
    task, cancel_req, handle, sub_state = recoverable[0]
    assert task.task_id == compute_task.task_id
    assert cancel_req is True
    assert handle is None
    assert sub_state == SubmissionState.NOT_SUBMITTED


async def test_journal_persists_execution_handle(tmp_path: Path, compute_task: ComputeTask) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    await journal.initialize()
    await journal.save_accepted(compute_task)

    await journal.save_execution_handle(
        compute_task.task_id, compute_task.attempt_id, "comfyui:abc123"
    )
    loaded = await journal.load(compute_task.task_id, compute_task.attempt_id)
    assert loaded is not None
    assert loaded.execution_handle == "comfyui:abc123"

    recoverable = await journal.recoverable()
    assert len(recoverable) == 1
    assert recoverable[0][2] == "comfyui:abc123"
    assert recoverable[0][3] == SubmissionState.SUBMITTED


async def test_journal_submission_state_transitions(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    await journal.initialize()

    await journal.save_accepted(compute_task)
    assert (
        await journal.load_submission_state(compute_task.task_id, compute_task.attempt_id)
        == SubmissionState.NOT_SUBMITTED
    )

    await journal.mark_submitting(compute_task.task_id, compute_task.attempt_id)
    assert (
        await journal.load_submission_state(compute_task.task_id, compute_task.attempt_id)
        == SubmissionState.SUBMITTING
    )

    await journal.mark_submitted(
        compute_task.task_id, compute_task.attempt_id, "comfyui:job-999"
    )
    assert (
        await journal.load_submission_state(compute_task.task_id, compute_task.attempt_id)
        == SubmissionState.SUBMITTED
    )
    loaded = await journal.load(compute_task.task_id, compute_task.attempt_id)
    assert loaded is not None
    assert loaded.execution_handle == "comfyui:job-999"

    await journal.mark_unknown(compute_task.task_id, compute_task.attempt_id)
    assert (
        await journal.load_submission_state(compute_task.task_id, compute_task.attempt_id)
        == SubmissionState.UNKNOWN
    )


async def test_journal_migration_from_legacy_schema(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    import sqlite3

    db_path = tmp_path / "legacy_journal.sqlite3"
    # Create legacy table without submission_state and without correlation_key
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE execution_attempts (
                task_id TEXT NOT NULL,
                attempt_id TEXT NOT NULL,
                idempotency_key TEXT NOT NULL UNIQUE,
                request_fingerprint TEXT NOT NULL,
                task_json TEXT NOT NULL,
                observation_json TEXT NOT NULL,
                state TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                cancel_requested INTEGER NOT NULL DEFAULT 0,
                execution_handle TEXT,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (task_id, attempt_id)
            )
            """
        )
        task_json = compute_task.model_dump_json(by_alias=True)
        obs_accepted = ComputeObservation(
            task_id=compute_task.task_id,
            attempt_id=compute_task.attempt_id,
            state=ExecutionState.ACCEPTED,
            sequence=0,
            observed_at=datetime.now(UTC),
        ).model_dump_json(by_alias=True)

        task_running_with_handle = deepcopy(compute_task)
        task_running_with_handle.attempt_id = type(compute_task.attempt_id)(
            "0199b862-1025-78be-bd71-c6969b74ab72"
        )
        task_running_with_handle.idempotency_key = "key-2"
        obs_with_handle = ComputeObservation(
            task_id=task_running_with_handle.task_id,
            attempt_id=task_running_with_handle.attempt_id,
            state=ExecutionState.RUNNING,
            sequence=1,
            observed_at=datetime.now(UTC),
            execution_handle="handle-xyz",
        ).model_dump_json(by_alias=True)

        task_running_no_handle = deepcopy(compute_task)
        task_running_no_handle.attempt_id = type(compute_task.attempt_id)(
            "0199b862-1025-78be-bd71-c6969b74ab73"
        )
        task_running_no_handle.idempotency_key = "key-3"
        obs_no_handle = ComputeObservation(
            task_id=task_running_no_handle.task_id,
            attempt_id=task_running_no_handle.attempt_id,
            state=ExecutionState.RUNNING,
            sequence=1,
            observed_at=datetime.now(UTC),
        ).model_dump_json(by_alias=True)

        conn.execute(
            """INSERT INTO execution_attempts VALUES
               (?, ?, ?, ?, ?, ?, 'ACCEPTED', 0, 0, NULL, ?)""",
            (
                str(compute_task.task_id),
                str(compute_task.attempt_id),
                compute_task.idempotency_key,
                compute_task.request_fingerprint,
                task_json,
                obs_accepted,
                datetime.now(UTC).isoformat(),
            ),
        )
        conn.execute(
            """INSERT INTO execution_attempts VALUES
               (?, ?, ?, ?, ?, ?, 'RUNNING', 1, 0, 'handle-xyz', ?)""",
            (
                str(task_running_with_handle.task_id),
                str(task_running_with_handle.attempt_id),
                task_running_with_handle.idempotency_key,
                task_running_with_handle.request_fingerprint,
                task_running_with_handle.model_dump_json(by_alias=True),
                obs_with_handle,
                datetime.now(UTC).isoformat(),
            ),
        )
        conn.execute(
            """INSERT INTO execution_attempts VALUES
               (?, ?, ?, ?, ?, ?, 'RUNNING', 1, 0, NULL, ?)""",
            (
                str(task_running_no_handle.task_id),
                str(task_running_no_handle.attempt_id),
                task_running_no_handle.idempotency_key,
                task_running_no_handle.request_fingerprint,
                task_running_no_handle.model_dump_json(by_alias=True),
                obs_no_handle,
                datetime.now(UTC).isoformat(),
            ),
        )

    # Initialize journal with the existing DB
    journal = SqliteExecutionJournalAdapter(db_path)
    await journal.initialize()

    # Verify migration results
    assert (
        await journal.load_submission_state(compute_task.task_id, compute_task.attempt_id)
        == SubmissionState.NOT_SUBMITTED
    )
    assert (
        await journal.load_submission_state(
            task_running_with_handle.task_id, task_running_with_handle.attempt_id
        )
        == SubmissionState.SUBMITTED
    )
    assert (
        await journal.load_submission_state(
            task_running_no_handle.task_id, task_running_no_handle.attempt_id
        )
        == SubmissionState.UNKNOWN
    )

    # Verify correlation_key was backfilled
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            "SELECT task_id, attempt_id, correlation_key FROM execution_attempts"
        ).fetchall()
        for t_id, a_id, corr in rows:
            assert corr == f"{t_id}:{a_id}"
