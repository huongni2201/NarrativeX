from __future__ import annotations

import asyncio
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from narrativex_gpu_worker.contracts import ComputeObservation, ComputeTask, ExecutionState
from narrativex_gpu_worker.contracts.fingerprint import request_fingerprint
from narrativex_gpu_worker.domain.execution_attempt import (
    AttemptState,
    ExecutionAttempt,
    InvalidExecutionTransition,
)
from narrativex_gpu_worker.domain.submission import SubmissionState


class SqliteExecutionJournalAdapter:
    """SQLite implementation of the local execution journal port.

    It stores only protocol tasks and observations. NarrativeX business state
    remains outside this adapter and outside the worker process.
    """

    def __init__(self, database_file: Path) -> None:
        self._database_file = database_file
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        await asyncio.to_thread(self._initialize_sync)

    async def save_accepted(self, task: ComputeTask) -> tuple[ComputeObservation, bool]:
        if request_fingerprint(task) != task.request_fingerprint:
            raise ValueError("request fingerprint does not match canonical payload")
        async with self._lock:
            return await asyncio.to_thread(self._save_accepted_sync, task)

    async def load(self, task_id: UUID, attempt_id: UUID) -> ComputeObservation | None:
        return await asyncio.to_thread(self._load_sync, task_id, attempt_id)

    async def replay(self, task: ComputeTask) -> ComputeObservation | None:
        return await asyncio.to_thread(self._replay_sync, task)

    async def load_task(self, task_id: UUID, attempt_id: UUID) -> ComputeTask | None:
        return await asyncio.to_thread(self._load_task_sync, task_id, attempt_id)

    async def update(self, observation: ComputeObservation) -> None:
        async with self._lock:
            await asyncio.to_thread(self._update_sync, observation)

    async def request_cancel(self, task_id: UUID, attempt_id: UUID) -> bool:
        async with self._lock:
            return await asyncio.to_thread(self._request_cancel_sync, task_id, attempt_id)

    async def is_cancel_requested(self, task_id: UUID, attempt_id: UUID) -> bool:
        return await asyncio.to_thread(self._is_cancel_requested_sync, task_id, attempt_id)

    async def save_execution_handle(
        self, task_id: UUID, attempt_id: UUID, execution_handle: str
    ) -> None:
        async with self._lock:
            await asyncio.to_thread(
                self._save_execution_handle_sync, task_id, attempt_id, execution_handle
            )

    async def mark_submitting(self, task_id: UUID, attempt_id: UUID) -> None:
        async with self._lock:
            await asyncio.to_thread(self._mark_submitting_sync, task_id, attempt_id)

    async def mark_submitted(
        self, task_id: UUID, attempt_id: UUID, execution_handle: str
    ) -> None:
        async with self._lock:
            await asyncio.to_thread(
                self._mark_submitted_sync, task_id, attempt_id, execution_handle
            )

    async def mark_unknown(self, task_id: UUID, attempt_id: UUID) -> None:
        async with self._lock:
            await asyncio.to_thread(self._mark_unknown_sync, task_id, attempt_id)

    async def load_submission_state(
        self, task_id: UUID, attempt_id: UUID
    ) -> SubmissionState | None:
        return await asyncio.to_thread(self._load_submission_state_sync, task_id, attempt_id)

    async def recoverable(self) -> list[tuple[ComputeTask, bool, str | None, SubmissionState]]:
        return await asyncio.to_thread(self._recoverable_sync)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_file)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize_sync(self) -> None:
        self._database_file.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS execution_attempts (
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
                    submission_state TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
                    correlation_key TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (task_id, attempt_id)
                )
                """
            )
            # Ensure columns exist if table was created by an older version
            pragma = {
                row[1]
                for row in connection.execute("PRAGMA table_info(execution_attempts)").fetchall()
            }
            if "cancel_requested" not in pragma:
                connection.execute(
                    "ALTER TABLE execution_attempts "
                    "ADD COLUMN cancel_requested INTEGER NOT NULL DEFAULT 0"
                )
            if "execution_handle" not in pragma:
                connection.execute(
                    "ALTER TABLE execution_attempts ADD COLUMN execution_handle TEXT"
                )
            if "submission_state" not in pragma:
                connection.execute(
                    "ALTER TABLE execution_attempts "
                    "ADD COLUMN submission_state TEXT NOT NULL DEFAULT 'NOT_SUBMITTED'"
                )
                # Migrate existing rows safely
                connection.execute(
                    """UPDATE execution_attempts
                       SET submission_state = 'SUBMITTED'
                       WHERE state = 'RUNNING' AND execution_handle IS NOT NULL AND execution_handle != ''"""
                )
                connection.execute(
                    """UPDATE execution_attempts
                       SET submission_state = 'UNKNOWN'
                       WHERE state = 'RUNNING' AND (execution_handle IS NULL OR execution_handle = '')"""
                )
                connection.execute(
                    """UPDATE execution_attempts
                       SET submission_state = 'NOT_SUBMITTED'
                       WHERE state = 'ACCEPTED'"""
                )
            if "correlation_key" not in pragma:
                connection.execute(
                    "ALTER TABLE execution_attempts ADD COLUMN correlation_key TEXT"
                )
            connection.execute(
                """UPDATE execution_attempts
                   SET correlation_key = task_id || ':' || attempt_id
                   WHERE correlation_key IS NULL"""
            )

    def _save_accepted_sync(self, task: ComputeTask) -> tuple[ComputeObservation, bool]:
        accepted_attempt = ExecutionAttempt.accepted(
            task.task_id, task.attempt_id, task.idempotency_key, task.request_fingerprint
        )
        accepted = ComputeObservation(
            task_id=accepted_attempt.task_id,
            attempt_id=accepted_attempt.attempt_id,
            state=ExecutionState.ACCEPTED,
            sequence=accepted_attempt.sequence,
            observed_at=datetime.now(UTC),
        )
        task_json = task.model_dump_json(by_alias=True)
        observation_json = accepted.model_dump_json(by_alias=True)
        with self._connect() as connection:
            existing = connection.execute(
                """SELECT task_id, attempt_id, idempotency_key, request_fingerprint,
                          observation_json FROM execution_attempts
                    WHERE (task_id = ? AND attempt_id = ?) OR idempotency_key = ?""",
                (str(task.task_id), str(task.attempt_id), task.idempotency_key),
            ).fetchone()
            if existing is not None:
                stored_observation = ComputeObservation.model_validate_json(
                    existing["observation_json"]
                )
                existing_attempt = ExecutionAttempt(
                    task_id=UUID(existing["task_id"]),
                    attempt_id=UUID(existing["attempt_id"]),
                    idempotency_key=existing["idempotency_key"],
                    request_fingerprint=existing["request_fingerprint"],
                    state=AttemptState(stored_observation.state.value),
                    sequence=stored_observation.sequence,
                )
                if not existing_attempt.matches_request(
                    task.task_id, task.attempt_id, task.idempotency_key, task.request_fingerprint
                ):
                    raise ValueError("fingerprint conflict")
                return stored_observation, False
            connection.execute(
                """INSERT INTO execution_attempts
                    (task_id, attempt_id, idempotency_key, request_fingerprint, task_json,
                     observation_json, state, sequence, cancel_requested,
                     execution_handle, submission_state, correlation_key, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)""",
                (
                    str(task.task_id),
                    str(task.attempt_id),
                    task.idempotency_key,
                    task.request_fingerprint,
                    task_json,
                    observation_json,
                    accepted.state.value,
                    accepted.sequence,
                    SubmissionState.NOT_SUBMITTED.value,
                    f"{task.task_id}:{task.attempt_id}",
                    accepted.observed_at.isoformat(),
                ),
            )
        return accepted, True

    def _load_sync(self, task_id: UUID, attempt_id: UUID) -> ComputeObservation | None:
        with self._connect() as connection:
            row = connection.execute(
                """SELECT observation_json FROM execution_attempts
                   WHERE task_id = ? AND attempt_id = ?""",
                (str(task_id), str(attempt_id)),
            ).fetchone()
        return (
            None if row is None else ComputeObservation.model_validate_json(row["observation_json"])
        )

    def _replay_sync(self, task: ComputeTask) -> ComputeObservation | None:
        with self._connect() as connection:
            row = connection.execute(
                """SELECT task_id, attempt_id, idempotency_key, request_fingerprint,
                          observation_json FROM execution_attempts
                   WHERE (task_id = ? AND attempt_id = ?) OR idempotency_key = ?""",
                (str(task.task_id), str(task.attempt_id), task.idempotency_key),
            ).fetchone()
        if row is None:
            return None
        if (
            row["task_id"] != str(task.task_id)
            or row["attempt_id"] != str(task.attempt_id)
            or row["idempotency_key"] != task.idempotency_key
            or row["request_fingerprint"] != task.request_fingerprint
        ):
            raise ValueError("fingerprint conflict")
        return ComputeObservation.model_validate_json(row["observation_json"])

    def _load_task_sync(self, task_id: UUID, attempt_id: UUID) -> ComputeTask | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT task_json FROM execution_attempts WHERE task_id = ? AND attempt_id = ?",
                (str(task_id), str(attempt_id)),
            ).fetchone()
        return None if row is None else ComputeTask.model_validate_json(row["task_json"])

    def _update_sync(self, observation: ComputeObservation) -> None:
        with self._connect() as connection:
            current = connection.execute(
                """SELECT idempotency_key, request_fingerprint, state, sequence, execution_handle
                   FROM execution_attempts WHERE task_id = ? AND attempt_id = ?""",
                (str(observation.task_id), str(observation.attempt_id)),
            ).fetchone()
            if current is None:
                raise LookupError("attempt not found")
            try:
                aggregate = ExecutionAttempt(
                    task_id=observation.task_id,
                    attempt_id=observation.attempt_id,
                    idempotency_key=current["idempotency_key"],
                    request_fingerprint=current["request_fingerprint"],
                    state=AttemptState(current["state"]),
                    sequence=current["sequence"],
                )
                _, changed = aggregate.apply(observation.state.value, observation.sequence)
            except InvalidExecutionTransition as exc:
                raise ValueError(str(exc)) from exc
            if not changed:
                return
            handle = observation.execution_handle or current["execution_handle"]
            connection.execute(
                """UPDATE execution_attempts
                   SET observation_json = ?, state = ?, sequence = ?, execution_handle = ?,
                       updated_at = ?
                   WHERE task_id = ? AND attempt_id = ?""",
                (
                    observation.model_dump_json(by_alias=True),
                    observation.state.value,
                    observation.sequence,
                    handle,
                    observation.observed_at.isoformat(),
                    str(observation.task_id),
                    str(observation.attempt_id),
                ),
            )

    def _request_cancel_sync(self, task_id: UUID, attempt_id: UUID) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                """UPDATE execution_attempts
                   SET cancel_requested = 1, updated_at = ?
                   WHERE task_id = ? AND attempt_id = ?
                     AND state NOT IN ('SUCCEEDED', 'FAILED', 'CANCELED')""",
                (datetime.now(UTC).isoformat(), str(task_id), str(attempt_id)),
            )
            return cursor.rowcount > 0

    def _is_cancel_requested_sync(self, task_id: UUID, attempt_id: UUID) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                """SELECT cancel_requested FROM execution_attempts
                   WHERE task_id = ? AND attempt_id = ?""",
                (str(task_id), str(attempt_id)),
            ).fetchone()
            return bool(row["cancel_requested"]) if row is not None else False

    def _mark_submitting_sync(self, task_id: UUID, attempt_id: UUID) -> None:
        with self._connect() as connection:
            connection.execute(
                """UPDATE execution_attempts
                   SET submission_state = ?, updated_at = ?
                   WHERE task_id = ? AND attempt_id = ?""",
                (
                    SubmissionState.SUBMITTING.value,
                    datetime.now(UTC).isoformat(),
                    str(task_id),
                    str(attempt_id),
                ),
            )

    def _mark_submitted_sync(
        self, task_id: UUID, attempt_id: UUID, execution_handle: str
    ) -> None:
        with self._connect() as connection:
            row = connection.execute(
                """SELECT observation_json FROM execution_attempts
                   WHERE task_id = ? AND attempt_id = ?""",
                (str(task_id), str(attempt_id)),
            ).fetchone()
            if row is None:
                return
            observation = ComputeObservation.model_validate_json(row["observation_json"])
            updated_obs = observation.model_copy(update={"execution_handle": execution_handle})
            connection.execute(
                """UPDATE execution_attempts
                   SET execution_handle = ?, submission_state = ?, observation_json = ?, updated_at = ?
                   WHERE task_id = ? AND attempt_id = ?""",
                (
                    execution_handle,
                    SubmissionState.SUBMITTED.value,
                    updated_obs.model_dump_json(by_alias=True),
                    datetime.now(UTC).isoformat(),
                    str(task_id),
                    str(attempt_id),
                ),
            )

    def _mark_unknown_sync(self, task_id: UUID, attempt_id: UUID) -> None:
        with self._connect() as connection:
            connection.execute(
                """UPDATE execution_attempts
                   SET submission_state = ?, updated_at = ?
                   WHERE task_id = ? AND attempt_id = ?""",
                (
                    SubmissionState.UNKNOWN.value,
                    datetime.now(UTC).isoformat(),
                    str(task_id),
                    str(attempt_id),
                ),
            )

    def _load_submission_state_sync(
        self, task_id: UUID, attempt_id: UUID
    ) -> SubmissionState | None:
        with self._connect() as connection:
            row = connection.execute(
                """SELECT submission_state FROM execution_attempts
                   WHERE task_id = ? AND attempt_id = ?""",
                (str(task_id), str(attempt_id)),
            ).fetchone()
            if row is None or not row["submission_state"]:
                return None
            return SubmissionState(row["submission_state"])

    def _save_execution_handle_sync(
        self, task_id: UUID, attempt_id: UUID, execution_handle: str
    ) -> None:
        self._mark_submitted_sync(task_id, attempt_id, execution_handle)

    def _recoverable_sync(self) -> list[tuple[ComputeTask, bool, str | None, SubmissionState]]:
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT task_json, cancel_requested, execution_handle, submission_state
                   FROM execution_attempts
                   WHERE state IN ('ACCEPTED', 'RUNNING')"""
            ).fetchall()
        return [
            (
                ComputeTask.model_validate_json(row["task_json"]),
                bool(row["cancel_requested"]),
                row["execution_handle"],
                SubmissionState(row["submission_state"])
                if row["submission_state"]
                else SubmissionState.NOT_SUBMITTED,
            )
            for row in rows
        ]


__all__ = ["SqliteExecutionJournalAdapter"]
