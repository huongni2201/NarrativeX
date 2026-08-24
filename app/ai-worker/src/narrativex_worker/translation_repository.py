"""Durable claim, chunk-operation, billing, and completion operations for translations."""

import hashlib
import json
import uuid
from dataclasses import dataclass

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.translation import TranslationProviderResponse, TranslationResult


@dataclass(frozen=True)
class ClaimedTranslationJob:
    stage_attempt_id: uuid.UUID
    generation_job_id: uuid.UUID
    job_id: str
    chapter_id: uuid.UUID
    project_id: uuid.UUID
    source_variant_id: uuid.UUID
    source_content_hash: str
    source_language: str
    source_text: str
    target_language: str


@dataclass(frozen=True)
class TranslationOperation:
    id: uuid.UUID
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

    async def heartbeat(self, stage_attempt_id: uuid.UUID, worker_id: str) -> bool:
        pool = self._require_pool()
        result = await pool.execute(
            """UPDATE stage_attempts SET heartbeat_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND worker_id = $2
              AND status = 'RUNNING'""",
            stage_attempt_id,
            worker_id,
        )
        return str(result) == "UPDATE 1"

    async def reserve_chunk_operation(
        self,
        claimed: ClaimedTranslationJob,
        provider_key: str,
        chunk_index: int,
        chunk_hash: str,
    ) -> TranslationOperation:
        fingerprint = hashlib.sha256(
            f"chapter-translation:{claimed.generation_job_id}:{claimed.source_variant_id}:"
            f"{claimed.source_content_hash}:{claimed.target_language.strip().lower()}:"
            f"{chunk_index}:{chunk_hash}:translation-v1".encode()
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
                return self._operation_from_row(row)

    async def reserve_operation(
        self, claimed: ClaimedTranslationJob, provider_key: str
    ) -> TranslationOperation:
        """Compatibility wrapper for callers that model a single translation chunk."""
        return await self.reserve_chunk_operation(
            claimed, provider_key, chunk_index=0, chunk_hash=claimed.source_content_hash
        )

    async def fence_before_provider_call(
        self, operation: TranslationOperation
    ) -> TranslationOperation:
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

    async def complete_chunk_operation(
        self,
        claimed: ClaimedTranslationJob,
        worker_id: str,
        operation: TranslationOperation,
        response: TranslationProviderResponse,
    ) -> None:
        billing = response.billing
        normalized = json.dumps({"content": response.content}, ensure_ascii=False, sort_keys=True)
        result_fingerprint = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        usage = billing.usage
        usage_json = json.dumps(
            {
                "prompt_tokens": usage.prompt_tokens,
                "candidate_tokens": usage.candidate_tokens,
                "thought_tokens": usage.thought_tokens,
                "cached_input_tokens": usage.cached_input_tokens,
                "tool_input_tokens": usage.tool_input_tokens,
                "total_tokens": usage.total_tokens,
                "traffic_type": usage.traffic_type,
            }
        )
        pricing = billing.pricing
        pricing_json = json.dumps(
            {
                "catalog_version": pricing.catalog_version,
                "model_key": pricing.model_key,
                "location": pricing.location,
                "pricing_mode": pricing.pricing_mode,
                "input_usd_per_million": str(pricing.input_usd_per_million),
                "cached_input_usd_per_million": str(pricing.cached_input_usd_per_million),
                "output_usd_per_million": str(pricing.output_usd_per_million),
            }
        )
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                await self._require_lease(connection, claimed, worker_id)
                updated = await connection.execute(
                    """UPDATE provider_operations SET status = 'COMPLETED',
                          normalized_result_json = $3::jsonb, result_fingerprint = $4,
                          actual_cost = $5, billing_currency = $6,
                          usage_json = $7::jsonb, pricing_snapshot_json = $8::jsonb,
                          completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                          row_version = row_version + 1
                          WHERE id = $1 AND status = 'UNKNOWN' AND row_version = $2""",
                    operation.id,
                    operation.row_version,
                    normalized,
                    result_fingerprint,
                    billing.actual_cost,
                    billing.currency,
                    usage_json,
                    pricing_json,
                )
                if updated != "UPDATE 1":
                    raise RuntimeError("Translation provider operation changed before completion")

    async def complete_translation(
        self,
        claimed: ClaimedTranslationJob,
        worker_id: str,
        content: str,
        provider: str,
        model: str,
    ) -> None:
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                await self._require_lease(connection, claimed, worker_id)
                await connection.execute(
                    """INSERT INTO chapter_content_variants
                      (chapter_id, source_variant_id, variant_type, language_code, content,
                       content_hash, source_content_hash, translation_status,
                       translation_provider, translation_model)
                      VALUES ($1, $2, 'TRANSLATION', $3, $4, $5, $6, 'COMPLETED', $7, $8)
                      ON CONFLICT DO NOTHING""",
                    claimed.chapter_id,
                    claimed.source_variant_id,
                    claimed.target_language,
                    content,
                    content_hash,
                    claimed.source_content_hash,
                    provider,
                    model,
                )
                stage = await connection.execute(
                    """UPDATE stage_attempts SET status = 'COMPLETED',
                      heartbeat_at = CURRENT_TIMESTAMP,
                      updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                      WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'""",
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if stage != "UPDATE 1":
                    raise RuntimeError("Worker lost the translation lease before completion")
                await connection.execute(
                    """UPDATE generation_jobs SET status = 'COMPLETED', progress = 100,
                      current_step = 'COMPLETED', error_code = NULL,
                      updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                      WHERE id = $1""",
                    claimed.generation_job_id,
                )

    async def complete(
        self,
        claimed: ClaimedTranslationJob,
        worker_id: str,
        operation: TranslationOperation,
        result: TranslationResult,
    ) -> None:
        """Compatibility path for the former single-operation translation flow."""
        if result.billing is None:
            raise RuntimeError("Provider billing is required to complete a translation operation")
        response = TranslationProviderResponse(
            content=result.content,
            provider=result.provider,
            model=result.model,
            billing=result.billing,
        )
        await self.complete_chunk_operation(claimed, worker_id, operation, response)
        await self.complete_translation(
            claimed, worker_id, result.content, result.provider, result.model
        )

    async def fail(
        self, claimed: ClaimedTranslationJob, worker_id: str, error_code: str, unknown: bool = False
    ) -> None:
        pool = self._require_pool()
        status = "UNKNOWN" if unknown else "FAILED"
        current_step = "UNKNOWN" if unknown else "FAILED"
        async with pool.acquire() as connection:
            async with connection.transaction():
                stage = await connection.execute(
                    """UPDATE stage_attempts SET status = $3, heartbeat_at = CURRENT_TIMESTAMP,
                      updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                      WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'""",
                    claimed.stage_attempt_id,
                    worker_id,
                    status,
                )
                if stage != "UPDATE 1":
                    return
                await connection.execute(
                    """UPDATE generation_jobs SET status = $2, current_step = $3, error_code = $4,
                      updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                      WHERE id = $1 AND status = 'RUNNING'""",
                    claimed.generation_job_id,
                    status,
                    current_step,
                    error_code[:80],
                )

    async def _require_lease(
        self, connection: asyncpg.Connection, claimed: ClaimedTranslationJob, worker_id: str
    ) -> None:
        lease = await connection.fetchval(
            """SELECT EXISTS(
                SELECT 1 FROM stage_attempts
                 WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
            )""",
            claimed.stage_attempt_id,
            worker_id,
        )
        if not lease:
            raise RuntimeError("Worker no longer owns the translation lease")

    @staticmethod
    def _operation_from_row(row: asyncpg.Record) -> TranslationOperation:
        raw = row["normalized_result_json"]
        parsed = json.loads(raw) if isinstance(raw, str) else raw
        return TranslationOperation(
            id=row["id"],
            status=row["status"],
            row_version=row["row_version"],
            content=parsed.get("content") if isinstance(parsed, dict) else None,
        )

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("TranslationWorkerRepository.connect() must be called before use")
        return self._pool
