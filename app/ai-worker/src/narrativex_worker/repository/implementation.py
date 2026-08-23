"""PostgreSQL source-of-truth repository for worker claim, lease, and lifecycle state."""

import hashlib
import json
import uuid
from dataclasses import dataclass
from typing import NoReturn

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.materialization import (
    materialize_characters,
    materialize_locations,
    materialize_storyboard,
)
from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    ProviderOperationStatus,
)


class ProviderOperationStateConflictError(RuntimeError):
    """The durable operation changed after the caller loaded its snapshot."""

    def __init__(self, operation_id: uuid.UUID, expected_version: int) -> None:
        super().__init__(
            f"Provider operation {operation_id} changed after row_version={expected_version}"
        )
        self.operation_id = operation_id
        self.expected_version = expected_version


class ProviderResultConflictError(RuntimeError):
    """A completed provider operation received a different immutable result."""

    def __init__(
        self,
        operation_id: uuid.UUID,
        persisted_fingerprint: str | None,
        incoming_fingerprint: str,
    ) -> None:
        self.operation_id = operation_id
        self.persisted_fingerprint = persisted_fingerprint
        self.incoming_fingerprint = incoming_fingerprint
        super().__init__(
            f"Provider operation {operation_id} is already COMPLETED with result fingerprint "
            f"{persisted_fingerprint or '<missing>'}; incoming fingerprint "
            f"{incoming_fingerprint} conflicts"
        )


class ProviderOperationInvalidTransitionError(RuntimeError):
    """The requested provider-operation transition violates the canonical state graph."""


ALLOWED_PROVIDER_TRANSITIONS: dict[ProviderOperationStatus, frozenset[ProviderOperationStatus]] = {
    ProviderOperationStatus.RESERVED: frozenset({ProviderOperationStatus.UNKNOWN}),
    ProviderOperationStatus.UNKNOWN: frozenset(
        {
            ProviderOperationStatus.SUBMITTED,
            ProviderOperationStatus.RUNNING,
            ProviderOperationStatus.COMPLETED,
            ProviderOperationStatus.FAILED,
        }
    ),
    ProviderOperationStatus.SUBMITTED: frozenset(
        {
            ProviderOperationStatus.RUNNING,
            ProviderOperationStatus.UNKNOWN,
            ProviderOperationStatus.COMPLETED,
            ProviderOperationStatus.FAILED,
        }
    ),
    ProviderOperationStatus.RUNNING: frozenset(
        {
            ProviderOperationStatus.UNKNOWN,
            ProviderOperationStatus.COMPLETED,
            ProviderOperationStatus.FAILED,
        }
    ),
    ProviderOperationStatus.COMPLETED: frozenset(),
    ProviderOperationStatus.FAILED: frozenset(),
}


@dataclass(frozen=True)
class DurableProviderOperation:
    id: uuid.UUID
    stage_attempt_id: uuid.UUID
    provider_key: str
    provider_operation_id: str | None
    status: ProviderOperationStatus
    row_version: int
    request_fingerprint: str
    normalized_result: ChapterAnalysisResult | None = None
    created: bool = False
    result_fingerprint: str | None = None


@dataclass(frozen=True)
class ClaimedChapterAnalysisJob:
    stage_attempt_id: uuid.UUID
    generation_job_id: uuid.UUID
    job_id: str
    requested_by_user_id: str
    request: ChapterAnalysisRequest


class WorkerRepository:
    def __init__(self, database_url: str, lease_seconds: int, pool_size: int = 5) -> None:
        self.database_url = database_url
        self.lease_seconds = lease_seconds
        self.pool_size = pool_size
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                self.database_url,
                min_size=1,
                max_size=self.pool_size,
            )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def claim_next(self, worker_id: str) -> ClaimedChapterAnalysisJob | None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT sa.id AS stage_attempt_id,
                           sa.generation_job_id,
                           gj.job_id,
                           gj.project_id,
                           gj.story_version_id,
                           gj.chapter_id,
                           gj.chapter_row_version,
                           gj.source_hash,
                           gj.source_text,
                           gj.source_language,
                           gj.requested_by_user_id
                      FROM stage_attempts sa
                      JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                     WHERE gj.job_type = 'CHAPTER_ANALYZE'
                       AND gj.status IN ('QUEUED', 'RUNNING', 'STALLED')
                       AND (
                           sa.status IN ('QUEUED', 'STALLED')
                           OR (
                               sa.status = 'RUNNING'
                               AND (
                                   sa.heartbeat_at IS NULL
                                   OR sa.heartbeat_at
                                      < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second')
                               )
                           )
                       )
                     ORDER BY sa.created_at, sa.id
                     FOR UPDATE OF sa SKIP LOCKED
                     LIMIT 1
                    """,
                    self.lease_seconds,
                )
                if row is None:
                    return None

                await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'RUNNING', worker_id = $1, heartbeat_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $2
                    """,
                    worker_id,
                    row["stage_attempt_id"],
                )
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'RUNNING', progress = GREATEST(progress, 5),
                           current_step = 'CHAPTER_ANALYSIS', updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status <> 'COMPLETED'
                    """,
                    row["generation_job_id"],
                )

                request = ChapterAnalysisRequest(
                    project_id=row["project_id"],
                    story_version_id=row["story_version_id"],
                    chapter_id=row["chapter_id"],
                    chapter_row_version=row["chapter_row_version"],
                    source_hash=row["source_hash"],
                    source_text=row["source_text"],
                    source_language=row["source_language"],
                )
                return ClaimedChapterAnalysisJob(
                    stage_attempt_id=row["stage_attempt_id"],
                    generation_job_id=row["generation_job_id"],
                    job_id=row["job_id"],
                    requested_by_user_id=row["requested_by_user_id"],
                    request=request,
                )

    async def heartbeat(self, stage_attempt_id: uuid.UUID, worker_id: str) -> bool:
        pool = self._require_pool()
        result = await pool.execute(
            """
            UPDATE stage_attempts
               SET heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
            """,
            stage_attempt_id,
            worker_id,
        )
        return str(result) == "UPDATE 1"

    async def reserve_provider_operation(
        self,
        claimed: ClaimedChapterAnalysisJob,
        provider_key: str,
        request_fingerprint: str,
    ) -> DurableProviderOperation:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    INSERT INTO provider_operations
                      (stage_attempt_id, provider_key, request_fingerprint, status)
                    VALUES ($1, $2, $3, 'RESERVED')
                    ON CONFLICT (provider_key, request_fingerprint) DO NOTHING
                    RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                              status, row_version, request_fingerprint, result_fingerprint,
                              normalized_result_json
                    """,
                    claimed.stage_attempt_id,
                    provider_key,
                    request_fingerprint,
                )
                created = row is not None
                if row is None:
                    row = await connection.fetchrow(
                        """
                        SELECT id, stage_attempt_id, provider_key, provider_operation_id,
                               status, row_version, request_fingerprint, result_fingerprint,
                               normalized_result_json
                          FROM provider_operations
                         WHERE provider_key = $1 AND request_fingerprint = $2
                         FOR UPDATE
                        """,
                        provider_key,
                        request_fingerprint,
                    )
                if row is None:
                    raise RuntimeError("Provider operation reservation disappeared")
                return self._provider_operation(row, created=created)

    async def mark_provider_operation_submitted(
        self,
        operation: DurableProviderOperation,
        provider_operation_id: str | None,
    ) -> DurableProviderOperation:
        return await self._transition_provider_operation(
            operation, ProviderOperationStatus.SUBMITTED, provider_operation_id
        )

    async def mark_provider_operation_submission_unknown(
        self, operation: DurableProviderOperation, reconcile_after_seconds: float
    ) -> DurableProviderOperation:
        """Persist the external-call fence before submission can cross the provider boundary."""
        self._assert_transition_allowed(operation, ProviderOperationStatus.UNKNOWN)
        pool = self._require_pool()
        async with pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                UPDATE provider_operations
                   SET status = 'UNKNOWN',
                       next_reconcile_at = CURRENT_TIMESTAMP + ($2 * INTERVAL '1 second'),
                       last_reconcile_error = NULL,
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                  WHERE id = $1
                    AND status = $3
                    AND row_version = $4
                  RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                            status, row_version, request_fingerprint, result_fingerprint,
                            normalized_result_json
                """,
                operation.id,
                reconcile_after_seconds,
                operation.status.value,
                operation.row_version,
            )
        if row is None:
            self._raise_state_conflict(operation)
        return self._provider_operation(row)

    async def schedule_provider_operation_reconciliation(
        self,
        operation: DurableProviderOperation,
        status: ProviderOperationStatus,
        provider_operation_id: str,
        *,
        error: str | None = None,
    ) -> DurableProviderOperation:
        if status not in (
            ProviderOperationStatus.UNKNOWN,
            ProviderOperationStatus.SUBMITTED,
            ProviderOperationStatus.RUNNING,
        ):
            raise ValueError(
                "Only non-terminal provider states can be scheduled for reconciliation"
            )
        if status is operation.status:
            return await self._update_reconciliation_metadata(
                operation, provider_operation_id, error
            )
        self._assert_transition_allowed(operation, status)
        pool = self._require_pool()
        async with pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                UPDATE provider_operations
                   SET status = $2,
                       provider_operation_id = $3,
                       reconcile_attempts = reconcile_attempts + 1,
                       next_reconcile_at = CURRENT_TIMESTAMP + INTERVAL '15 seconds',
                       last_reconcile_error = $4,
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                  WHERE id = $1
                    AND status = $5
                    AND row_version = $6
                  RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                            status, row_version, request_fingerprint, result_fingerprint,
                            normalized_result_json
                """,
                operation.id,
                status.value,
                provider_operation_id,
                error[:2000] if error is not None else None,
                operation.status.value,
                operation.row_version,
            )
        if row is None:
            self._raise_state_conflict(operation)
        return self._provider_operation(row)

    async def record_provider_reconcile_error(
        self, operation: DurableProviderOperation, error: str
    ) -> DurableProviderOperation:
        pool = self._require_pool()
        row = await pool.fetchrow(
            """
            UPDATE provider_operations
               SET reconcile_attempts = reconcile_attempts + 1,
                   next_reconcile_at = CURRENT_TIMESTAMP + INTERVAL '15 seconds',
                   last_reconcile_error = $2,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = $1
               AND status = $3
               AND row_version = $4
             RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                       status, row_version, request_fingerprint, result_fingerprint,
                       normalized_result_json
            """,
            operation.id,
            error[:2000],
            operation.status.value,
            operation.row_version,
        )
        if row is None:
            self._raise_state_conflict(operation)
        return self._provider_operation(row)

    async def _update_reconciliation_metadata(
        self,
        operation: DurableProviderOperation,
        provider_operation_id: str,
        error: str | None,
    ) -> DurableProviderOperation:
        pool = self._require_pool()
        row = await pool.fetchrow(
            """
            UPDATE provider_operations
               SET provider_operation_id = $2,
                   reconcile_attempts = reconcile_attempts + 1,
                   next_reconcile_at = CURRENT_TIMESTAMP + INTERVAL '15 seconds',
                   last_reconcile_error = $3,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = $1
               AND status = $4
               AND row_version = $5
             RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                       status, row_version, request_fingerprint, result_fingerprint,
                       normalized_result_json
            """,
            operation.id,
            provider_operation_id,
            error[:2000] if error is not None else None,
            operation.status.value,
            operation.row_version,
        )
        if row is None:
            self._raise_state_conflict(operation)
        return self._provider_operation(row)

    @staticmethod
    def _assert_transition_allowed(
        operation: DurableProviderOperation, next_status: ProviderOperationStatus
    ) -> None:
        if next_status not in ALLOWED_PROVIDER_TRANSITIONS[operation.status]:
            raise ProviderOperationInvalidTransitionError(
                f"Provider operation {operation.id} cannot transition "
                f"from {operation.status.value} to {next_status.value}"
            )

    @staticmethod
    def _raise_state_conflict(operation: DurableProviderOperation) -> NoReturn:
        raise ProviderOperationStateConflictError(operation.id, operation.row_version)

    async def suspend_provider_reconciliation(
        self, operation: DurableProviderOperation, error: str
    ) -> DurableProviderOperation:
        """Keep the provider outcome UNKNOWN but stop unsafe/hot reconciliation attempts."""
        pool = self._require_pool()
        row = await pool.fetchrow(
            """
            UPDATE provider_operations
               SET reconcile_attempts = reconcile_attempts + 1,
                   next_reconcile_at = NULL,
                   last_reconcile_error = $2,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = $1
               AND status = $3
               AND row_version = $4
             RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                       status, row_version, request_fingerprint, result_fingerprint,
                       normalized_result_json
            """,
            operation.id,
            error[:2000],
            operation.status.value,
            operation.row_version,
        )
        if row is None:
            self._raise_state_conflict(operation)
        return self._provider_operation(row)

    async def persist_provider_result(
        self,
        operation: DurableProviderOperation,
        provider_operation_id: str | None,
        result: ChapterAnalysisResult,
    ) -> DurableProviderOperation:
        serialized, incoming_fingerprint = _canonical_provider_result(result)
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                if operation.status is ProviderOperationStatus.COMPLETED:
                    current = await self._load_provider_operation_for_update(
                        connection, operation.id
                    )
                    if current.status is not ProviderOperationStatus.COMPLETED:
                        self._raise_state_conflict(operation)
                    return await self._resolve_completed_provider_result(
                        connection, current, incoming_fingerprint
                    )

                self._assert_transition_allowed(operation, ProviderOperationStatus.COMPLETED)
                row = await connection.fetchrow(
                    """
                    UPDATE provider_operations
                       SET status = 'COMPLETED',
                           provider_operation_id = COALESCE($2, provider_operation_id),
                           normalized_result_json = $3::jsonb,
                           result_fingerprint = $4,
                           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status = $5
                       AND row_version = $6
                     RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                               status, row_version, request_fingerprint, result_fingerprint,
                               normalized_result_json
                    """,
                    operation.id,
                    provider_operation_id,
                    serialized,
                    incoming_fingerprint,
                    operation.status.value,
                    operation.row_version,
                )
                if row is not None:
                    return self._provider_operation(row)

                current = await self._load_provider_operation_for_update(connection, operation.id)
                if current.status is ProviderOperationStatus.COMPLETED:
                    return await self._resolve_completed_provider_result(
                        connection, current, incoming_fingerprint
                    )
                self._raise_state_conflict(operation)

    async def _load_provider_operation_for_update(
        self, connection: asyncpg.Connection, operation_id: uuid.UUID
    ) -> DurableProviderOperation:
        row = await connection.fetchrow(
            """
            SELECT id, stage_attempt_id, provider_key, provider_operation_id,
                   status, row_version, request_fingerprint, result_fingerprint,
                   normalized_result_json
              FROM provider_operations
             WHERE id = $1
             FOR UPDATE
            """,
            operation_id,
        )
        if row is None:
            raise RuntimeError(f"Provider operation {operation_id} not found")
        return self._provider_operation(row)

    async def _resolve_completed_provider_result(
        self,
        connection: asyncpg.Connection,
        durable: DurableProviderOperation,
        incoming_fingerprint: str,
    ) -> DurableProviderOperation:
        persisted_fingerprint = durable.result_fingerprint
        if persisted_fingerprint is None:
            if durable.normalized_result is None:
                raise RuntimeError(
                    f"Provider operation {durable.id} is COMPLETED without a durable result"
                )
            _, persisted_fingerprint = _canonical_provider_result(durable.normalized_result)
            if persisted_fingerprint == incoming_fingerprint:
                row = await connection.fetchrow(
                    """
                    UPDATE provider_operations
                       SET result_fingerprint = $2,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status = 'COMPLETED'
                       AND row_version = $3
                       AND result_fingerprint IS NULL
                     RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                               status, row_version, request_fingerprint, result_fingerprint,
                               normalized_result_json
                    """,
                    durable.id,
                    persisted_fingerprint,
                    durable.row_version,
                )
                if row is None:
                    self._raise_state_conflict(durable)
                return self._provider_operation(row)

        if persisted_fingerprint == incoming_fingerprint:
            return durable

        raise ProviderResultConflictError(
            durable.id,
            persisted_fingerprint,
            incoming_fingerprint,
        )

    async def mark_provider_operation_status(
        self,
        operation: DurableProviderOperation,
        status: ProviderOperationStatus,
        provider_operation_id: str | None = None,
    ) -> DurableProviderOperation:
        self._assert_transition_allowed(operation, status)
        if status is ProviderOperationStatus.COMPLETED:
            raise ValueError("COMPLETED requires persist_provider_result() with a durable result")
        return await self._transition_provider_operation(operation, status, provider_operation_id)

    async def get_provider_operation(self, operation_id: uuid.UUID) -> DurableProviderOperation:
        pool = self._require_pool()
        row = await pool.fetchrow(
            """
            SELECT id, stage_attempt_id, provider_key, provider_operation_id,
                   status, row_version, request_fingerprint, result_fingerprint,
                   normalized_result_json
              FROM provider_operations
             WHERE id = $1
            """,
            operation_id,
        )
        if row is None:
            raise RuntimeError(f"Provider operation {operation_id} not found")
        return self._provider_operation(row)

    async def list_provider_operations(
        self, statuses: tuple[ProviderOperationStatus, ...], limit: int = 50
    ) -> list[DurableProviderOperation]:
        pool = self._require_pool()
        rows = await pool.fetch(
            """
            SELECT po.id, po.stage_attempt_id, po.provider_key, po.provider_operation_id,
                   po.status, po.row_version, po.request_fingerprint, po.result_fingerprint,
                   po.normalized_result_json
              FROM provider_operations po
              JOIN stage_attempts sa ON sa.id = po.stage_attempt_id
             WHERE po.status = ANY($1::text[])
               AND po.next_reconcile_at IS NOT NULL
               AND po.next_reconcile_at <= CURRENT_TIMESTAMP
               AND sa.status IN ('RUNNING', 'STALLED', 'UNKNOWN')
             ORDER BY po.next_reconcile_at, po.reserved_at, po.id
             LIMIT $2
            """,
            [status.value for status in statuses],
            limit,
        )
        return [self._provider_operation(row) for row in rows]

    async def _transition_provider_operation(
        self,
        operation: DurableProviderOperation,
        next_status: ProviderOperationStatus,
        provider_operation_id: str | None = None,
    ) -> DurableProviderOperation:
        self._assert_transition_allowed(operation, next_status)
        pool = self._require_pool()
        async with pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                UPDATE provider_operations
                   SET status = $2,
                       provider_operation_id = COALESCE($3, provider_operation_id),
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                 WHERE id = $1
                   AND status = $4
                   AND row_version = $5
                 RETURNING id, stage_attempt_id, provider_key, provider_operation_id,
                           status, row_version, request_fingerprint, result_fingerprint,
                           normalized_result_json
                """,
                operation.id,
                next_status.value,
                provider_operation_id,
                operation.status.value,
                operation.row_version,
            )
        if row is None:
            self._raise_state_conflict(operation)
        return self._provider_operation(row)

    @staticmethod
    def _provider_operation(
        row: asyncpg.Record, *, created: bool = False
    ) -> DurableProviderOperation:
        raw_result = row["normalized_result_json"]
        normalized_result: ChapterAnalysisResult | None = None
        if raw_result is not None:
            parsed_result = json.loads(raw_result) if isinstance(raw_result, str) else raw_result
            normalized_result = ChapterAnalysisResult.model_validate(parsed_result)
        return DurableProviderOperation(
            id=row["id"],
            stage_attempt_id=row["stage_attempt_id"],
            provider_key=row["provider_key"],
            provider_operation_id=row["provider_operation_id"],
            status=ProviderOperationStatus(row["status"]),
            row_version=row["row_version"],
            request_fingerprint=row["request_fingerprint"],
            normalized_result=normalized_result,
            created=created,
            result_fingerprint=row["result_fingerprint"],
        )

    async def complete(
        self,
        claimed: ClaimedChapterAnalysisJob,
        worker_id: str,
        result: ChapterAnalysisResult,
    ) -> None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                lease_owned = await connection.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM stage_attempts
                         WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    )
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if not lease_owned:
                    raise RuntimeError("Worker no longer owns the analysis lease")

                snapshot_matches = await connection.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM chapters
                         WHERE id = $1 AND story_version_id = $2
                           AND row_version = $3 AND source_hash = $4
                    )
                    """,
                    claimed.request.chapter_id,
                    claimed.request.story_version_id,
                    claimed.request.chapter_row_version,
                    claimed.request.source_hash,
                )
                if not snapshot_matches:
                    raise RuntimeError("Chapter changed while analysis was running")

                await connection.execute(
                    "SELECT pg_advisory_xact_lock($1)",
                    claimed.request.project_id,
                )
                project_characters = await materialize_characters(connection, claimed, result)
                project_locations = await materialize_locations(connection, claimed, result)
                await materialize_storyboard(
                    connection,
                    claimed,
                    result,
                    project_characters,
                    project_locations,
                )

                stage_update = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'COMPLETED', heartbeat_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if stage_update != "UPDATE 1":
                    raise RuntimeError("Worker lost the analysis lease before completion")
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'COMPLETED', progress = 100, current_step = 'COMPLETED',
                           error_code = NULL, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                    """,
                    claimed.generation_job_id,
                )

    async def fail(
        self,
        claimed: ClaimedChapterAnalysisJob,
        worker_id: str,
        error_code: str,
    ) -> None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                stage_update = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'FAILED', heartbeat_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if stage_update != "UPDATE 1":
                    return

                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'FAILED', current_step = 'FAILED', error_code = $2,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND status = 'RUNNING'
                    """,
                    claimed.generation_job_id,
                    error_code[:80],
                )

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("WorkerRepository.connect() must be called before use")
        return self._pool


def _canonical_provider_result(result: ChapterAnalysisResult) -> tuple[str, str]:
    serialized = json.dumps(
        result.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return serialized, hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def provider_request_fingerprint(claimed: ClaimedChapterAnalysisJob, provider_key: str) -> str:
    payload = "|".join(
        (
            provider_key,
            "CHAPTER_ANALYZE",
            str(claimed.generation_job_id),
            str(claimed.request.chapter_id),
            claimed.request.source_hash,
        )
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
