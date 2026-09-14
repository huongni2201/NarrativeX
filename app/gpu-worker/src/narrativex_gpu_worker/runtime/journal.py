from __future__ import annotations

import asyncio
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from narrativex_gpu_worker.domain.fingerprint import request_fingerprint
from narrativex_gpu_worker.domain.models import ComputeObservation, ComputeTask, ExecutionState


class ExecutionJournal:
    """Execution-local replay journal; it contains protocol data and no business records."""

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

    async def recoverable(self) -> list[ComputeTask]:
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
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (task_id, attempt_id)
                )
                """
            )

    def _save_accepted_sync(self, task: ComputeTask) -> tuple[ComputeObservation, bool]:
        accepted = ComputeObservation(
            task_id=task.task_id,
            attempt_id=task.attempt_id,
            state=ExecutionState.ACCEPTED,
            sequence=0,
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
                if (
                    existing["task_id"] != str(task.task_id)
                    or existing["attempt_id"] != str(task.attempt_id)
                    or existing["idempotency_key"] != task.idempotency_key
                    or existing["request_fingerprint"] != task.request_fingerprint
                ):
                    raise ValueError("fingerprint conflict")
                return ComputeObservation.model_validate_json(existing["observation_json"]), False
            connection.execute(
                """INSERT INTO execution_attempts
                   (task_id, attempt_id, idempotency_key, request_fingerprint, task_json,
                    observation_json, state, sequence, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(task.task_id),
                    str(task.attempt_id),
                    task.idempotency_key,
                    task.request_fingerprint,
                    task_json,
                    observation_json,
                    accepted.state.value,
                    accepted.sequence,
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
                "SELECT sequence FROM execution_attempts WHERE task_id = ? AND attempt_id = ?",
                (str(observation.task_id), str(observation.attempt_id)),
            ).fetchone()
            if current is None:
                raise LookupError("attempt not found")
            if observation.sequence <= current["sequence"]:
                return
            connection.execute(
                """UPDATE execution_attempts SET observation_json = ?, state = ?, sequence = ?,
                   updated_at = ? WHERE task_id = ? AND attempt_id = ?""",
                (
                    observation.model_dump_json(by_alias=True),
                    observation.state.value,
                    observation.sequence,
                    observation.observed_at.isoformat(),
                    str(observation.task_id),
                    str(observation.attempt_id),
                ),
            )

    def _recoverable_sync(self) -> list[ComputeTask]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT task_json FROM execution_attempts WHERE state IN ('ACCEPTED', 'RUNNING')"
            ).fetchall()
        return [ComputeTask.model_validate_json(row["task_json"]) for row in rows]
