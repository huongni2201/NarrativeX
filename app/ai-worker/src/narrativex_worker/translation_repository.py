"""Durable claim and completion operations for immutable chapter translations."""

import hashlib
import json
from dataclasses import dataclass
from decimal import Decimal

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.translation import TranslationResult


@dataclass(frozen=True)
class ClaimedTranslationJob:
    stage_attempt_id: int
    generation_job_id: int
    job_id: str
    chapter_id: int
    project_id: int
    source_variant_id: int
    source_content_hash: str
    source_language: str
    source_text: str
    target_language: str


@dataclass(frozen=True)
class TranslationOperation:
    id: int
    status: str
    row_version: int
    content: str | None = None


class TranslationWorkerRepository:
    def __init__(self, database_url: str, lease_seconds: int, pool_size: int = 5) -> None:
        self.database_url = database_url
        self.lease_seconds = lease_seconds
        self.pool_size = pool_size
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                self.database_url, min_size=1, max_size=self.pool_size
            )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def claim_next(self, worker_id: str) -> ClaimedTranslationJob | None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT sa.id AS stage_attempt_id, sa.generation_job_id, gj.job_id,
                           gj.project_id, gj.chapter_id, gj.source_variant_id,
                           gj.target_language, cv.content AS source_text,
                           cv.content_hash AS source_content_hash,
                           cv.language_code AS source_language
                      FROM stage_attempts sa
                      JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                      JOIN chapter_content_variants cv ON cv.id = gj.source_variant_id
                     WHERE gj.job_type = 'CHAPTER_TRANSLATE'
                       AND gj.status IN ('QUEUED', 'RUNNING', 'STALLED')
                       AND (sa.status IN ('QUEUED', 'STALLED') OR
                            (sa.status = 'RUNNING' AND
                             (sa.heartbeat_at IS NULL OR sa.heartbeat_at <
                              CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second'))))
                     ORDER BY sa.created_at, sa.id
                     FOR UPDATE OF sa SKIP LOCKED LIMIT 1
                    """,
                    self.lease_seconds,
                )
                if row is None:
                    return None
                await connection.execute(
                    """
                    UPDATE stage_attempts SET status = 'RUNNING', worker_id = $1,
                      heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                      row_version = row_version + 1 WHERE id = $2
                    """,
                    worker_id,
                    row["stage_attempt_id"],
                )
                await connection.execute(
                    """
                    UPDATE generation_jobs SET status = 'RUNNING', progress = GREATEST(progress, 5),
                      current_step = 'CHAPTER_TRANSLATION', updated_at = CURRENT_TIMESTAMP,
                      row_version = row_version + 1 WHERE id = $1 AND status <> 'COMPLETED'
                    """,
                    row["generation_job_id"],
                )
                return ClaimedTranslationJob(
                    stage_attempt_id=row["stage_attempt_id"],
                    generation_job_id=row["generation_job_id"],
                    job_id=row["job_id"],
                    chapter_id=row["chapter_id"],
                    project_id=row["project_id"],
                    source_variant_id=row["source_variant_id"],
                    source_content_hash=row["source_content_hash"],
                    source_language=row["source_language"],
                    source_text=row["source_text"],
                    target_language=row["target_language"],
                )

    async def heartbeat(self, stage_attempt_id: int, worker_id: str) -> bool:
        pool = self._require_pool()
        result = await pool.execute(
            """UPDATE stage_attempts SET heartbeat_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'""",
            stage_attempt_id,
            worker_id,
        )
        return str(result) == "UPDATE 1"

    async def reserve_operation(
        self, claimed: ClaimedTranslationJob, provider_key: str
    ) -> TranslationOperation:
        fingerprint = hashlib.sha256(
            f"chapter-translation:{claimed.source_variant_id}:{claimed.source_content_hash}:"
            f"{claimed.target_language}".encode()
        ).hexdigest()
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    INSERT INTO provider_operations(stage_attempt_id, provider_key,
                      request_fingerprint, status) VALUES ($1, $2, $3, 'RESERVED')
                    ON CONFLICT (provider_key, request_fingerprint) DO NOTHING
                    RETURNING id, status, row_version, normalized_result_json
                    """,
                    claimed.stage_attempt_id,
                    provider_key,
                    fingerprint,
                )
                if row is None:
                    row = await connection.fetchrow(
                        """SELECT id, status, row_version, normalized_result_json
                           FROM provider_operations WHERE provider_key = $1
                           AND request_fingerprint = $2 FOR UPDATE""",
                        provider_key,
                        fingerprint,
                    )
                if row is None:
                    raise RuntimeError("Translation provider operation reservation disappeared")
                raw = row["normalized_result_json"]
                parsed = json.loads(raw) if isinstance(raw, str) else raw
                return TranslationOperation(
                    id=row["id"], status=row["status"], row_version=row["row_version"],
                    content=parsed.get("content") if isinstance(parsed, dict) else None,
                )

    async def fence_before_provider_call(self, operation: TranslationOperation) -> TranslationOperation:
        pool = self._require_pool()
        row = await pool.fetchrow(
            """UPDATE provider_operations SET status = 'UNKNOWN',
              updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
              WHERE id = $1 AND status = 'RESERVED' AND row_version = $2
              RETURNING id, status, row_version""",
            operation.id,
            operation.row_version,
        )
        if row is None:
            raise RuntimeError("Translation provider operation changed before submission")
        return TranslationOperation(row["id"], row["status"], row["row_version"])

    async def complete(
        self, claimed: ClaimedTranslationJob, worker_id: str,
        operation: TranslationOperation, result: TranslationResult,
    ) -> None:
        content_hash = hashlib.sha256(result.content.encode("utf-8")).hexdigest()
        normalized = json.dumps({"content": result.content}, ensure_ascii=False, sort_keys=True)
        result_fingerprint = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        input_tokens = max(0, result.input_tokens)
        output_tokens = max(0, result.output_tokens)
        actual_cost = (Decimal(input_tokens) * Decimal("0.15") + Decimal(output_tokens) * Decimal("0.60")) / Decimal("1000000")
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                lease = await connection.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM stage_attempts WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING')",
                    claimed.stage_attempt_id, worker_id,
                )
                if not lease:
                    raise RuntimeError("Worker no longer owns the translation lease")
                if operation.status == "UNKNOWN":
                    await connection.execute(
                        """UPDATE provider_operations SET status = 'COMPLETED',
                          normalized_result_json = $3::jsonb, result_fingerprint = $4,
                          actual_cost = $5, billing_currency = 'USD',
                          usage_json = $6::jsonb, pricing_snapshot_json = $7::jsonb,
                          completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                          row_version = row_version + 1
                          WHERE id = $1 AND status = 'UNKNOWN' AND row_version = $2""",
                        operation.id, operation.row_version, normalized, result_fingerprint,
                        actual_cost, json.dumps({"prompt_tokens": input_tokens, "candidate_tokens": output_tokens}),
                        json.dumps({"catalog_version": "vertex-public-2026-08-19", "model_key": result.model, "pricing_mode": "STANDARD"}),
                    )
                await connection.execute(
                    """INSERT INTO chapter_content_variants
                      (chapter_id, source_variant_id, variant_type, language_code, content,
                       content_hash, source_content_hash, translation_status,
                       translation_provider, translation_model)
                      VALUES ($1, $2, 'TRANSLATION', $3, $4, $5, $6, 'COMPLETED', $7, $8)
                      ON CONFLICT (chapter_id, variant_type, language_code, content_hash) DO NOTHING""",
                    claimed.chapter_id, claimed.source_variant_id, claimed.target_language,
                    result.content, content_hash, claimed.source_content_hash,
                    result.provider, result.model,
                )
                stage = await connection.execute(
                    """UPDATE stage_attempts SET status = 'COMPLETED', heartbeat_at = CURRENT_TIMESTAMP,
                      updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                      WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'""",
                    claimed.stage_attempt_id, worker_id,
                )
                if stage != "UPDATE 1":
                    raise RuntimeError("Worker lost the translation lease before completion")
                await connection.execute(
                    """UPDATE generation_jobs SET status = 'COMPLETED', progress = 100,
                      current_step = 'COMPLETED', error_code = NULL,
                      updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1 WHERE id = $1""",
                    claimed.generation_job_id,
                )

    async def fail(self, claimed: ClaimedTranslationJob, worker_id: str, error_code: str, unknown: bool = False) -> None:
        pool = self._require_pool()
        status = "UNKNOWN" if unknown else "FAILED"
        current_step = "UNKNOWN" if unknown else "FAILED"
        async with pool.acquire() as connection:
            async with connection.transaction():
                await connection.execute(
                    """UPDATE stage_attempts SET status = $3, heartbeat_at = CURRENT_TIMESTAMP,
                      updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                      WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'""",
                    claimed.stage_attempt_id, worker_id, status,
                )
                await connection.execute(
                    """UPDATE generation_jobs SET status = $2, current_step = $3, error_code = $4,
                      updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                      WHERE id = $1 AND status = 'RUNNING'""",
                    claimed.generation_job_id, status, current_step, error_code[:80],
                )

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("TranslationWorkerRepository.connect() must be called before use")
        return self._pool
