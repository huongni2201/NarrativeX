"""Durable, lease-fenced checkpoints for chapter-analysis provider subcalls."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.repository.analysis_fingerprint import result_fingerprint


class AnalysisCheckpointStatus(StrEnum):
    RESERVED = "RESERVED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class AnalysisCheckpoint:
    id: uuid.UUID
    generation_job_id: uuid.UUID
    stage_attempt_id: uuid.UUID
    step_key: str
    input_fingerprint: str
    claim_owner: str
    lease_version: int
    status: AnalysisCheckpointStatus
    result_json: dict[str, Any] | None
    result_hash: str | None
    provider_operation_id: uuid.UUID | None


class AnalysisCheckpointRepository:
    """PostgreSQL facade; each mutation is a short transaction outside provider awaits."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def claim(
        self,
        *,
        stage_attempt_id: uuid.UUID,
        step_key: str,
        input_fingerprint: str,
        claim_owner: str,
    ) -> AnalysisCheckpoint:
        async with self._pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    INSERT INTO analysis_checkpoints
                        (generation_job_id, stage_attempt_id, step_key, input_fingerprint,
                         claim_owner, lease_version, status)
                    SELECT sa.generation_job_id, sa.id, $2, $3, $4::varchar, 1, 'RESERVED'
                      FROM stage_attempts sa
                     WHERE sa.id = $1
                       AND sa.worker_id = $4
                       AND sa.status = 'RUNNING'
                    ON CONFLICT (generation_job_id, step_key, input_fingerprint)
                    DO UPDATE SET
                        stage_attempt_id = EXCLUDED.stage_attempt_id,
                        claim_owner = EXCLUDED.claim_owner,
                        lease_version = analysis_checkpoints.lease_version + 1,
                        status = CASE
                            WHEN analysis_checkpoints.status = 'COMPLETED' THEN 'COMPLETED'
                            WHEN analysis_checkpoints.status = 'UNKNOWN' THEN 'UNKNOWN'
                            WHEN analysis_checkpoints.status = 'RUNNING'
                                 AND analysis_checkpoints.provider_operation_id IS NOT NULL
                                THEN 'UNKNOWN'
                            ELSE 'RESERVED'
                        END,
                        updated_at = CURRENT_TIMESTAMP,
                        row_version = analysis_checkpoints.row_version + 1
                    WHERE analysis_checkpoints.status IN ('COMPLETED', 'UNKNOWN')
                       OR EXISTS (
                            SELECT 1
                              FROM stage_attempts current_sa
                             WHERE current_sa.id = EXCLUDED.stage_attempt_id
                               AND current_sa.worker_id = EXCLUDED.claim_owner
                               AND current_sa.status = 'RUNNING'
                       )
                    RETURNING *
                    """,
                    stage_attempt_id,
                    step_key,
                    input_fingerprint,
                    claim_owner,
                )
                if row is None:
                    raise RuntimeError("analysis checkpoint claim lost the outer stage lease")
                return _checkpoint(row)

    async def begin_provider_call(
        self,
        checkpoint: AnalysisCheckpoint,
        *,
        provider_key: str,
    ) -> AnalysisCheckpoint:
        """Persist the UNKNOWN external-call fence and linked provider operation atomically."""
        if checkpoint.status is AnalysisCheckpointStatus.COMPLETED:
            return checkpoint
        if checkpoint.status is AnalysisCheckpointStatus.UNKNOWN:
            raise RuntimeError(
                "analysis checkpoint outcome is UNKNOWN; refusing blind resubmission"
            )

        async with self._pool.acquire() as connection:
            async with connection.transaction():
                provider_operation_id = await connection.fetchval(
                    """
                    INSERT INTO provider_operations
                        (stage_attempt_id, provider_key, status, request_fingerprint)
                    VALUES ($1, $2, 'UNKNOWN', $3)
                    RETURNING id
                    """,
                    checkpoint.stage_attempt_id,
                    provider_key,
                    checkpoint.input_fingerprint,
                )
                row = await connection.fetchrow(
                    """
                    UPDATE analysis_checkpoints ac
                       SET status = 'UNKNOWN',
                           provider_operation_id = $4,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE ac.id = $1
                       AND ac.lease_version = $2
                       AND ac.claim_owner = $3
                       AND ac.status IN ('RESERVED', 'RUNNING', 'FAILED')
                       AND EXISTS (
                            SELECT 1
                              FROM stage_attempts sa
                             WHERE sa.id = ac.stage_attempt_id
                               AND sa.worker_id = $3
                               AND sa.status = 'RUNNING'
                       )
                    RETURNING ac.*
                    """,
                    checkpoint.id,
                    checkpoint.lease_version,
                    checkpoint.claim_owner,
                    provider_operation_id,
                )
                if row is None:
                    raise RuntimeError(
                        "analysis checkpoint provider fence lost the outer stage lease"
                    )
                return _checkpoint(row)

    async def complete_provider_call(
        self,
        checkpoint: AnalysisCheckpoint,
        *,
        result: dict[str, Any],
        provider_response_id: str,
    ) -> AnalysisCheckpoint:
        """Atomically persist the subcall result and checkpoint completion."""
        if checkpoint.provider_operation_id is None:
            raise RuntimeError("analysis checkpoint has no linked provider operation")
        result_text, result_hash = result_fingerprint(result)

        async with self._pool.acquire() as connection:
            async with connection.transaction():
                operation_updated = await connection.fetchval(
                    """
                    UPDATE provider_operations
                       SET provider_operation_id = $2,
                           status = 'COMPLETED',
                           result_fingerprint = $3,
                           normalized_result_json = $4::jsonb,
                           completed_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status = 'UNKNOWN'
                    RETURNING id
                    """,
                    checkpoint.provider_operation_id,
                    provider_response_id,
                    result_hash,
                    result_text,
                )
                if operation_updated is None:
                    raise RuntimeError("analysis subcall provider operation lost its UNKNOWN fence")

                row = await connection.fetchrow(
                    """
                    UPDATE analysis_checkpoints ac
                       SET status = 'COMPLETED',
                           result_json = $4::jsonb,
                           result_hash = $5,
                           completed_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE ac.id = $1
                       AND ac.lease_version = $2
                       AND ac.claim_owner = $3
                       AND ac.status = 'UNKNOWN'
                       AND EXISTS (
                            SELECT 1
                              FROM stage_attempts sa
                             WHERE sa.id = ac.stage_attempt_id
                               AND sa.worker_id = $3
                               AND sa.status = 'RUNNING'
                       )
                    RETURNING ac.*
                    """,
                    checkpoint.id,
                    checkpoint.lease_version,
                    checkpoint.claim_owner,
                    result_text,
                    result_hash,
                )
                if row is None:
                    raise RuntimeError("analysis checkpoint completion lost its lease fence")
                return _checkpoint(row)

    async def fail_provider_call(
        self,
        checkpoint: AnalysisCheckpoint,
        *,
        provider_response_id: str,
    ) -> AnalysisCheckpoint:
        """Persist a conclusive provider or validation failure."""
        if checkpoint.provider_operation_id is None:
            raise RuntimeError("analysis checkpoint has no linked provider operation")

        async with self._pool.acquire() as connection:
            async with connection.transaction():
                operation_updated = await connection.fetchval(
                    """
                    UPDATE provider_operations
                       SET provider_operation_id = $2,
                           status = 'FAILED',
                           completed_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status = 'UNKNOWN'
                    RETURNING id
                    """,
                    checkpoint.provider_operation_id,
                    provider_response_id,
                )
                if operation_updated is None:
                    raise RuntimeError("analysis subcall provider operation lost its UNKNOWN fence")

                row = await connection.fetchrow(
                    """
                    UPDATE analysis_checkpoints ac
                       SET status = 'FAILED',
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE ac.id = $1
                       AND ac.lease_version = $2
                       AND ac.claim_owner = $3
                       AND ac.status = 'UNKNOWN'
                       AND EXISTS (
                            SELECT 1
                              FROM stage_attempts sa
                             WHERE sa.id = ac.stage_attempt_id
                               AND sa.worker_id = $3
                               AND sa.status = 'RUNNING'
                       )
                    RETURNING ac.*
                    """,
                    checkpoint.id,
                    checkpoint.lease_version,
                    checkpoint.claim_owner,
                )
                if row is None:
                    raise RuntimeError("analysis checkpoint failure lost its lease fence")
                return _checkpoint(row)

    async def mark_running(self, checkpoint: AnalysisCheckpoint) -> AnalysisCheckpoint:
        return await self._transition(checkpoint, AnalysisCheckpointStatus.RUNNING)

    async def mark_unknown(self, checkpoint: AnalysisCheckpoint) -> AnalysisCheckpoint:
        return await self._transition(checkpoint, AnalysisCheckpointStatus.UNKNOWN)

    async def fail(self, checkpoint: AnalysisCheckpoint) -> AnalysisCheckpoint:
        return await self._transition(checkpoint, AnalysisCheckpointStatus.FAILED)

    async def complete(
        self,
        checkpoint: AnalysisCheckpoint,
        *,
        result: dict[str, Any],
        provider_operation_id: uuid.UUID | None,
    ) -> AnalysisCheckpoint:
        """Complete deterministic/non-provider checkpoints."""
        result_text, result_hash = result_fingerprint(result)
        row = await self._pool.fetchrow(
            """
            UPDATE analysis_checkpoints ac
               SET status = 'COMPLETED',
                   result_json = $4::jsonb,
                   result_hash = $5,
                   provider_operation_id = $6,
                   completed_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE ac.id = $1
               AND ac.lease_version = $2
               AND ac.claim_owner = $3
               AND ac.status IN ('RESERVED', 'RUNNING')
               AND EXISTS (
                    SELECT 1
                      FROM stage_attempts sa
                     WHERE sa.id = ac.stage_attempt_id
                       AND sa.worker_id = $3
                       AND sa.status = 'RUNNING'
               )
            RETURNING ac.*
            """,
            checkpoint.id,
            checkpoint.lease_version,
            checkpoint.claim_owner,
            result_text,
            result_hash,
            provider_operation_id,
        )
        if row is not None:
            return _checkpoint(row)

        latest = await self.get(checkpoint.id)
        if latest.status is AnalysisCheckpointStatus.COMPLETED:
            if latest.result_hash != result_hash:
                raise RuntimeError("terminal analysis checkpoint result is immutable")
            return latest
        raise RuntimeError("analysis checkpoint completion lost its lease fence")

    async def get(self, checkpoint_id: uuid.UUID) -> AnalysisCheckpoint:
        row = await self._pool.fetchrow(
            "SELECT * FROM analysis_checkpoints WHERE id = $1",
            checkpoint_id,
        )
        if row is None:
            raise KeyError(checkpoint_id)
        return _checkpoint(row)

    async def _transition(
        self,
        checkpoint: AnalysisCheckpoint,
        status: AnalysisCheckpointStatus,
    ) -> AnalysisCheckpoint:
        row = await self._pool.fetchrow(
            """
            UPDATE analysis_checkpoints ac
               SET status = $4,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE ac.id = $1
               AND ac.lease_version = $2
               AND ac.claim_owner = $3
               AND ac.status <> 'COMPLETED'
               AND EXISTS (
                    SELECT 1
                      FROM stage_attempts sa
                     WHERE sa.id = ac.stage_attempt_id
                       AND sa.worker_id = $3
                       AND sa.status = 'RUNNING'
               )
            RETURNING ac.*
            """,
            checkpoint.id,
            checkpoint.lease_version,
            checkpoint.claim_owner,
            status.value,
        )
        if row is None:
            raise RuntimeError("analysis checkpoint transition lost its lease fence")
        return _checkpoint(row)


def _checkpoint(row: asyncpg.Record) -> AnalysisCheckpoint:
    result = row["result_json"]
    if isinstance(result, str):
        result = json.loads(result)
    return AnalysisCheckpoint(
        id=row["id"],
        generation_job_id=row["generation_job_id"],
        stage_attempt_id=row["stage_attempt_id"],
        step_key=row["step_key"],
        input_fingerprint=row["input_fingerprint"],
        claim_owner=row["claim_owner"],
        lease_version=int(row["lease_version"]),
        status=AnalysisCheckpointStatus(row["status"]),
        result_json=result,
        result_hash=row["result_hash"],
        provider_operation_id=row["provider_operation_id"],
    )
