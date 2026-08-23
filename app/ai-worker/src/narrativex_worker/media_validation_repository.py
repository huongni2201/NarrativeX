"""PostgreSQL-backed media validation queue and compare-and-set result persistence."""

from dataclasses import dataclass
from typing import cast
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-untyped]


@dataclass(frozen=True)
class ClaimedMediaValidationJob:
    id: UUID
    account_id: str
    media_asset_id: UUID
    storage_key: str
    declared_type: str
    declared_content_type: str
    expected_size_bytes: int
    expected_sha256: str
    attempts: int
    lease_token: UUID
    row_version: int


class LeaseLostError(RuntimeError):
    """Raised when a media-validation worker no longer owns its durable lease."""


class MediaValidationRepository:
    def __init__(self, database_url: str, lease_seconds: int = 60, pool_size: int = 5) -> None:
        self.database_url = database_url
        self.lease_seconds = lease_seconds
        self.pool_size = pool_size
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(
            dsn=self.database_url,
            min_size=1,
            max_size=self.pool_size,
            command_timeout=30,
        )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def claim_next(self, worker_id: str) -> ClaimedMediaValidationJob | None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    WITH candidate AS (
                        SELECT id
                          FROM media_validation_jobs
                         WHERE (
                               status IN ('QUEUED', 'RETRYABLE')
                           AND next_attempt_at <= CURRENT_TIMESTAMP
                         )
                            OR (status = 'RUNNING' AND lease_until < CURRENT_TIMESTAMP)
                         ORDER BY next_attempt_at, created_at, id
                         LIMIT 1
                         FOR UPDATE SKIP LOCKED
                    )
                    UPDATE media_validation_jobs job
                       SET status = 'RUNNING', worker_id = $1,
                           lease_token = $2,
                           lease_until = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 second'),
                           attempts = job.attempts + 1,
                           row_version = job.row_version + 1,
                           updated_at = CURRENT_TIMESTAMP
                      FROM candidate
                     WHERE job.id = candidate.id
                     RETURNING job.id, job.account_id, job.media_asset_id, job.storage_key,
                               job.declared_type, job.declared_content_type,
                               job.expected_size_bytes, job.expected_sha256, job.attempts,
                               job.lease_token, job.row_version
                    """,
                    worker_id,
                    uuid4(),
                    self.lease_seconds,
                )
        return None if row is None else self._job(row)

    async def heartbeat(self, job_id: UUID, worker_id: str, lease_token: UUID) -> bool:
        pool = self._require_pool()
        result = await pool.execute(
            """
            UPDATE media_validation_jobs
               SET lease_until = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 second'),
                   updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
               AND worker_id = $2
               AND lease_token = $4
               AND status = 'RUNNING'
               AND lease_until > CURRENT_TIMESTAMP
            """,
            job_id,
            worker_id,
            self.lease_seconds,
            lease_token,
        )
        return cast(str, result) == "UPDATE 1"

    async def complete(
        self,
        job: ClaimedMediaValidationJob,
        worker_id: str,
        *,
        status: str,
        detected_content_type: str | None = None,
        detected_container: str | None = None,
        detected_codec: str | None = None,
        width: int | None = None,
        height: int | None = None,
        duration_ms: int | None = None,
        error_code: str | None = None,
        error_detail: str | None = None,
    ) -> bool:
        pool = self._require_pool()
        asset_status = "READY" if status == "READY" else "REJECTED"
        async with pool.acquire() as connection:
            async with connection.transaction():
                fenced = await connection.fetchrow(
                    """
                    UPDATE media_validation_jobs
                       SET status = 'COMPLETED', worker_id = NULL, lease_token = NULL,
                           lease_until = NULL, row_version = row_version + 1,
                           last_error_code = $3, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1
                       AND account_id = $2
                       AND worker_id = $4
                       AND lease_token = $5
                       AND status = 'RUNNING'
                       AND lease_until > CURRENT_TIMESTAMP
                    RETURNING media_asset_id, account_id
                    """,
                    job.id,
                    job.account_id,
                    _safe_error_code(error_code),
                    worker_id,
                    job.lease_token,
                )
                if fenced is None:
                    raise LeaseLostError("media validation lease was lost before completion")
                if (
                    fenced["media_asset_id"] != job.media_asset_id
                    or fenced["account_id"] != job.account_id
                ):
                    raise RuntimeError("media validation job does not match its claimed asset")

                updated = await connection.fetchval(
                    """
                    UPDATE media_assets
                       SET status = $3,
                           detected_content_type = $4,
                           detected_container = $5,
                           detected_codec = $6,
                           width = $7,
                           height = $8,
                           duration_ms = COALESCE($9, duration_ms),
                           validation_error_code = $10,
                           validation_error_detail = $11,
                           validated_at = CURRENT_TIMESTAMP,
                           checksum_verified_at = CASE
                               WHEN $3::VARCHAR(24) = 'READY' THEN COALESCE(
                                   checksum_verified_at, CURRENT_TIMESTAMP
                               )
                               ELSE checksum_verified_at
                           END
                     WHERE id = $1 AND account_id = $2 AND status = 'VALIDATING'
                    RETURNING id
                    """,
                    fenced["media_asset_id"],
                    fenced["account_id"],
                    asset_status,
                    detected_content_type,
                    detected_container,
                    detected_codec,
                    width,
                    height,
                    duration_ms,
                    _safe_error_code(error_code),
                    _safe_error_detail(error_detail),
                )
                if updated is None:
                    raise RuntimeError("media validation asset was not in VALIDATING state")
                await connection.execute(
                    """
                    UPDATE media_upload_sessions
                       SET status = $3
                     WHERE account_id = $1 AND media_asset_id = $2 AND status = 'VALIDATING'
                    """,
                    job.account_id,
                    job.media_asset_id,
                    asset_status,
                )
                if asset_status == "REJECTED":
                    await connection.execute(
                        """
                        INSERT INTO media_storage_cleanup_tasks
                          (id, storage_key, reason, status, attempt_count, next_attempt_at)
                        VALUES ($1, $2, 'VALIDATION_REJECTED', 'PENDING', 0, CURRENT_TIMESTAMP)
                        ON CONFLICT (storage_key) WHERE status IN ('PENDING', 'RUNNING') DO NOTHING
                        """,
                        uuid4(),
                        job.storage_key,
                    )
        return True

    async def retry_or_fail(
        self, job: ClaimedMediaValidationJob, worker_id: str, error_code: str
    ) -> bool:
        pool = self._require_pool()
        code = _safe_error_code(error_code) or "VALIDATION_RETRY_EXHAUSTED"
        async with pool.acquire() as connection:
            async with connection.transaction():
                if job.attempts < 3:
                    result = await connection.fetchrow(
                        """
                        UPDATE media_validation_jobs
                           SET status = 'RETRYABLE', worker_id = NULL, lease_token = NULL,
                               lease_until = NULL, row_version = row_version + 1,
                               next_attempt_at = CURRENT_TIMESTAMP
                                   + (POWER(2, LEAST(attempts, 6)) * INTERVAL '1 second'),
                               last_error_code = $3, updated_at = CURRENT_TIMESTAMP
                         WHERE id = $1
                           AND worker_id = $2
                           AND lease_token = $4
                           AND status = 'RUNNING'
                           AND lease_until > CURRENT_TIMESTAMP
                        RETURNING id
                        """,
                        job.id,
                        worker_id,
                        code,
                        job.lease_token,
                    )
                    if result is None:
                        raise LeaseLostError("media validation lease was lost before retry")
                    return True
                fenced = await connection.fetchrow(
                    """
                    UPDATE media_validation_jobs
                       SET status = 'FAILED', worker_id = NULL, lease_token = NULL,
                           lease_until = NULL, row_version = row_version + 1,
                           last_error_code = 'VALIDATION_RETRY_EXHAUSTED',
                           updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1
                       AND account_id = $2
                       AND worker_id = $3
                       AND lease_token = $4
                       AND status = 'RUNNING'
                       AND lease_until > CURRENT_TIMESTAMP
                    RETURNING media_asset_id, account_id
                    """,
                    job.id,
                    job.account_id,
                    worker_id,
                    job.lease_token,
                )
                if fenced is None:
                    raise LeaseLostError("media validation lease was lost before failure")
                updated_asset = await connection.fetchval(
                    """
                    UPDATE media_assets
                       SET status = 'REJECTED',
                           validation_error_code = 'VALIDATION_RETRY_EXHAUSTED',
                           validation_error_detail = NULL, validated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND account_id = $2 AND status = 'VALIDATING'
                    RETURNING id
                    """,
                    fenced["media_asset_id"],
                    fenced["account_id"],
                )
                if updated_asset is None:
                    raise RuntimeError("media validation asset was not in VALIDATING state")
                await connection.execute(
                    """
                    UPDATE media_upload_sessions
                       SET status = 'REJECTED'
                     WHERE account_id = $1 AND media_asset_id = $2 AND status = 'VALIDATING'
                    """,
                    job.account_id,
                    job.media_asset_id,
                )
                await connection.execute(
                    """
                    INSERT INTO media_storage_cleanup_tasks
                      (id, storage_key, reason, status, attempt_count, next_attempt_at)
                    VALUES ($1, $2, 'VALIDATION_RETRY_EXHAUSTED', 'PENDING', 0, CURRENT_TIMESTAMP)
                    ON CONFLICT (storage_key) WHERE status IN ('PENDING', 'RUNNING') DO NOTHING
                    """,
                    uuid4(),
                    job.storage_key,
                )
        return True

    @staticmethod
    def _job(row: asyncpg.Record) -> ClaimedMediaValidationJob:
        return ClaimedMediaValidationJob(
            id=row["id"],
            account_id=row["account_id"],
            media_asset_id=row["media_asset_id"],
            storage_key=row["storage_key"],
            declared_type=row["declared_type"],
            declared_content_type=row["declared_content_type"],
            expected_size_bytes=row["expected_size_bytes"],
            expected_sha256=row["expected_sha256"].lower(),
            attempts=row["attempts"],
            lease_token=row["lease_token"],
            row_version=row["row_version"],
        )

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("MediaValidationRepository.connect() must be called before use")
        return self._pool


def _safe_error_code(value: str | None) -> str | None:
    if value is None:
        return None
    return "".join(char for char in value.upper() if char.isalnum() or char in "_-")[:80] or None


def _safe_error_detail(value: str | None) -> str | None:
    if value is None:
        return None
    return " ".join(value.split())[:512] or None
