import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.narration.errors import (
    NarrationLeaseLostError,
    narration_reconcile_delay_seconds,
)
from narrativex_worker.narration.models import AlignmentSpan
from narrativex_worker.narration.pricing import TtsPricingSnapshot
from narrativex_worker.narration.storage import StoredMediaAsset
from narrativex_worker.schema import ProviderOperationStatus


class NarrationProviderStateConflictError(RuntimeError):
    pass


class NarrationClaimStateConflictError(RuntimeError):
    pass


@dataclass(frozen=True)
class ClaimedNarrationJob:
    stage_attempt_id: uuid.UUID
    generation_job_id: uuid.UUID
    job_id: str
    narration_request_id: uuid.UUID
    project_id: uuid.UUID
    chapter_id: uuid.UUID
    chapter_row_version: int
    source_hash: str
    source_text: str
    voice_id: str
    language: str
    speaking_rate: float
    request_fingerprint: str
    voice_reference_storage_key: str | None = None


@dataclass(frozen=True)
class DurableNarrationProviderOperation:
    id: uuid.UUID
    stage_attempt_id: uuid.UUID
    provider_key: str
    status: ProviderOperationStatus
    row_version: int
    request_fingerprint: str
    result: dict[str, Any] | None
    result_fingerprint: str | None
    next_reconcile_at: datetime | None = None
    reconcile_attempts: int = 0
    last_reconcile_error: str | None = None
    created: bool = False


class NarrationWorkerRepository:
    def __init__(self, database_url: str, lease_seconds: int, *, pool_size: int = 5) -> None:
        self.database_url = database_url
        self.lease_seconds = lease_seconds
        if pool_size < 1:
            raise ValueError("Narration repository pool_size must be positive")
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

    async def claim_next(self, worker_id: str) -> ClaimedNarrationJob | None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT sa.id AS stage_attempt_id,
                           sa.status AS stage_attempt_status,
                           sa.row_version AS stage_attempt_row_version,
                           gj.id AS generation_job_id,
                           gj.status AS generation_job_status,
                           gj.row_version AS generation_job_row_version,
                           gj.job_id,
                           nr.id AS narration_request_id,
                           nr.project_id,
                           nr.chapter_id,
                           nr.chapter_row_version,
                           nr.source_hash,
                           nr.source_text,
                           nr.voice_id,
                           nr.language,
                           nr.speaking_rate,
                           nr.request_fingerprint,
                           COALESCE(
                               vra.storage_key,
                               NULLIF(vc.metadata_json ->> 'referenceStorageKey', '')
                           ) AS voice_reference_storage_key
                      FROM stage_attempts sa
                      JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                      JOIN narration_operations no ON no.stage_attempt_id = sa.id
                      JOIN narration_requests nr ON nr.id = no.narration_request_id
                      LEFT JOIN voice_reference_assets vra
                        ON vra.id = nr.voice_reference_asset_id
                       AND vra.status = 'READY'
                      LEFT JOIN voice_catalog vc ON vc.id = nr.voice_id
                     WHERE gj.job_type = 'NARRATION_GENERATE'
                       AND gj.status IN ('QUEUED', 'RUNNING', 'STALLED')
                       AND sa.stage_name = 'NARRATION_TTS'
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
                return await self._claim_candidate(
                    connection,
                    row,
                    worker_id,
                    current_step="NARRATION_TTS",
                )

    async def claim_due_reconciliation(self, worker_id: str) -> ClaimedNarrationJob | None:
        """Claim one due UNKNOWN narration operation without allowing a hot loop."""
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT sa.id AS stage_attempt_id,
                           sa.status AS stage_attempt_status,
                           sa.row_version AS stage_attempt_row_version,
                           gj.id AS generation_job_id,
                           gj.status AS generation_job_status,
                           gj.row_version AS generation_job_row_version,
                           gj.job_id,
                           nr.id AS narration_request_id,
                           nr.project_id,
                           nr.chapter_id,
                           nr.chapter_row_version,
                           nr.source_hash,
                           nr.source_text,
                           nr.voice_id,
                           nr.language,
                           nr.speaking_rate,
                           nr.request_fingerprint,
                           COALESCE(
                               vra.storage_key,
                               NULLIF(vc.metadata_json ->> 'referenceStorageKey', '')
                           ) AS voice_reference_storage_key
                      FROM provider_operations po
                      JOIN stage_attempts sa ON sa.id = po.stage_attempt_id
                      JOIN generation_jobs gj ON gj.id = sa.generation_job_id
                      JOIN narration_operations no ON no.stage_attempt_id = sa.id
                      JOIN narration_requests nr ON nr.id = no.narration_request_id
                      LEFT JOIN voice_reference_assets vra
                        ON vra.id = nr.voice_reference_asset_id
                       AND vra.status = 'READY'
                      LEFT JOIN voice_catalog vc ON vc.id = nr.voice_id
                     WHERE po.status = 'UNKNOWN'
                       AND po.next_reconcile_at IS NOT NULL
                       AND po.next_reconcile_at <= CURRENT_TIMESTAMP
                       AND gj.job_type = 'NARRATION_GENERATE'
                       AND gj.status = 'UNKNOWN'
                       AND sa.stage_name = 'NARRATION_TTS'
                       AND sa.status = 'UNKNOWN'
                     ORDER BY po.next_reconcile_at, po.id
                     FOR UPDATE OF sa SKIP LOCKED
                     LIMIT 1
                    """
                )
                if row is None:
                    return None
                return await self._claim_candidate(
                    connection,
                    row,
                    worker_id,
                    current_step="NARRATION_TTS_RECONCILE",
                )

    async def _claim_candidate(
        self,
        connection: asyncpg.Connection,
        row: asyncpg.Record,
        worker_id: str,
        *,
        current_step: str,
    ) -> ClaimedNarrationJob | None:
        parent_result = await connection.execute(
            """
            UPDATE generation_jobs
               SET status = 'RUNNING', progress = GREATEST(progress, 5),
                   current_step = $1, updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = $2
               AND status = $3
               AND row_version = $4
            """,
            current_step,
            row["generation_job_id"],
            row["generation_job_status"],
            row["generation_job_row_version"],
        )
        if parent_result != "UPDATE 1":
            return None

        stage_result = await connection.execute(
            """
            UPDATE stage_attempts
               SET status = 'RUNNING', worker_id = $1,
                   heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = $2
               AND status = $3
               AND row_version = $4
            """,
            worker_id,
            row["stage_attempt_id"],
            row["stage_attempt_status"],
            row["stage_attempt_row_version"],
        )
        if stage_result != "UPDATE 1":
            raise NarrationClaimStateConflictError(f"stage_attempt_id={row['stage_attempt_id']}")

        return ClaimedNarrationJob(
            stage_attempt_id=row["stage_attempt_id"],
            generation_job_id=row["generation_job_id"],
            job_id=str(row["job_id"]),
            narration_request_id=row["narration_request_id"],
            project_id=row["project_id"],
            chapter_id=row["chapter_id"],
            chapter_row_version=int(row["chapter_row_version"]),
            source_hash=str(row["source_hash"]),
            source_text=str(row["source_text"]),
            voice_id=str(row["voice_id"]),
            language=str(row["language"]),
            speaking_rate=float(row["speaking_rate"]),
            request_fingerprint=str(row["request_fingerprint"]),
            voice_reference_storage_key=(
                str(row["voice_reference_storage_key"])
                if row["voice_reference_storage_key"] is not None
                else None
            ),
        )

    async def heartbeat(self, stage_attempt_id: uuid.UUID, worker_id: str) -> bool:
        result = await self._require_pool().execute(
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
        self, stage_attempt_id: uuid.UUID, provider_key: str, request_fingerprint: str
    ) -> DurableNarrationProviderOperation:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    INSERT INTO provider_operations
                        (stage_attempt_id, provider_key, request_fingerprint, status)
                    VALUES ($1, $2, $3, 'RESERVED')
                    ON CONFLICT (provider_key, request_fingerprint) DO NOTHING
                    RETURNING id, stage_attempt_id, provider_key, status, row_version,
                              request_fingerprint, normalized_result_json, result_fingerprint,
                              next_reconcile_at, reconcile_attempts, last_reconcile_error
                    """,
                    stage_attempt_id,
                    provider_key,
                    request_fingerprint,
                )
                created = row is not None
                if row is None:
                    row = await connection.fetchrow(
                        """
                        SELECT id, stage_attempt_id, provider_key, status, row_version,
                               request_fingerprint, normalized_result_json, result_fingerprint,
                               next_reconcile_at, reconcile_attempts, last_reconcile_error
                          FROM provider_operations
                         WHERE provider_key = $1 AND request_fingerprint = $2
                         FOR UPDATE
                        """,
                        provider_key,
                        request_fingerprint,
                    )
                if row is None:
                    raise RuntimeError("Narration provider operation reservation disappeared")
                operation = self._operation(row, created=created)
                return operation

    async def fence_submission_unknown(
        self,
        operation: DurableNarrationProviderOperation,
        reconcile_after_seconds: float = 15,
    ) -> DurableNarrationProviderOperation:
        if operation.status is not ProviderOperationStatus.RESERVED:
            raise ValueError(
                "Only RESERVED narration provider operations may cross the submit fence"
            )
        row = await self._require_pool().fetchrow(
            """
            UPDATE provider_operations
               SET status = 'UNKNOWN',
                   next_reconcile_at = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 second'),
                   reconcile_attempts = 0, last_reconcile_error = NULL,
                   updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
             WHERE id = $1 AND status = 'RESERVED' AND row_version = $2
             RETURNING id, stage_attempt_id, provider_key, status, row_version,
                       request_fingerprint, normalized_result_json, result_fingerprint,
                       next_reconcile_at, reconcile_attempts, last_reconcile_error
            """,
            operation.id,
            operation.row_version,
            reconcile_after_seconds,
        )
        if row is None:
            raise NarrationProviderStateConflictError(str(operation.id))
        return self._operation(row)

    async def complete_provider_operation(
        self,
        operation: DurableNarrationProviderOperation,
        result: dict[str, Any],
        *,
        character_count: int,
        pricing: TtsPricingSnapshot,
    ) -> DurableNarrationProviderOperation:
        serialized = json.dumps(result, sort_keys=True, separators=(",", ":"))
        fingerprint = hashlib.sha256(serialized.encode()).hexdigest()
        actual_cost = pricing.actual_cost(character_count)
        usage_json = json.dumps({"characters": character_count}, separators=(",", ":"))
        pricing_json = json.dumps(
            {
                "catalogVersion": pricing.catalog_version,
                "voiceTier": pricing.voice_tier,
                "sku": pricing.sku,
                "usdPerMillionCharacters": str(pricing.usd_per_million_characters),
            },
            separators=(",", ":"),
        )
        row = await self._require_pool().fetchrow(
            """
            UPDATE provider_operations
               SET status = 'COMPLETED', normalized_result_json = $2::jsonb,
                   result_fingerprint = $3, actual_cost = $4, billing_currency = 'USD',
                   usage_json = $5::jsonb, pricing_snapshot_json = $6::jsonb,
                   completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
                   next_reconcile_at = NULL, last_reconcile_error = NULL,
                   updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
             WHERE id = $1 AND status = 'UNKNOWN' AND row_version = $7
             RETURNING id, stage_attempt_id, provider_key, status, row_version,
                       request_fingerprint, normalized_result_json, result_fingerprint,
                       next_reconcile_at, reconcile_attempts, last_reconcile_error
            """,
            operation.id,
            serialized,
            fingerprint,
            actual_cost,
            usage_json,
            pricing_json,
            operation.row_version,
        )
        if row is not None:
            return self._operation(row)
        current = await self.get_provider_operation(operation.id)
        if (
            current.status is ProviderOperationStatus.COMPLETED
            and current.result_fingerprint == fingerprint
        ):
            return current
        raise NarrationProviderStateConflictError(str(operation.id))

    async def fail_provider_operation(
        self, operation: DurableNarrationProviderOperation
    ) -> DurableNarrationProviderOperation:
        row = await self._require_pool().fetchrow(
            """
            UPDATE provider_operations
               SET status = 'FAILED', next_reconcile_at = NULL, last_reconcile_error = NULL,
                   updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
             WHERE id = $1 AND status = 'UNKNOWN' AND row_version = $2
             RETURNING id, stage_attempt_id, provider_key, status, row_version,
                       request_fingerprint, normalized_result_json, result_fingerprint,
                       next_reconcile_at, reconcile_attempts, last_reconcile_error
            """,
            operation.id,
            operation.row_version,
        )
        if row is None:
            raise NarrationProviderStateConflictError(str(operation.id))
        return self._operation(row)

    async def get_provider_operation(
        self, operation_id: uuid.UUID
    ) -> DurableNarrationProviderOperation:
        row = await self._require_pool().fetchrow(
            """
            SELECT id, stage_attempt_id, provider_key, status, row_version,
                   request_fingerprint, normalized_result_json, result_fingerprint,
                   next_reconcile_at, reconcile_attempts, last_reconcile_error
              FROM provider_operations
             WHERE id = $1
            """,
            operation_id,
        )
        if row is None:
            raise RuntimeError(f"Narration provider operation {operation_id} not found")
        return self._operation(row)

    async def schedule_provider_reconciliation(
        self,
        operation: DurableNarrationProviderOperation,
        *,
        error: str,
        next_reconcile_at: datetime | None = None,
    ) -> DurableNarrationProviderOperation:
        """CAS-update UNKNOWN reconciliation metadata and retain the ambiguous outcome."""
        if operation.status is not ProviderOperationStatus.UNKNOWN:
            raise ValueError("Only UNKNOWN narration operations can be reconciled")
        next_at = next_reconcile_at or (
            datetime.now(UTC)
            + timedelta(seconds=narration_reconcile_delay_seconds(operation.reconcile_attempts))
        )
        row = await self._require_pool().fetchrow(
            """
            UPDATE provider_operations
               SET next_reconcile_at = $2,
                   reconcile_attempts = reconcile_attempts + 1,
                   last_reconcile_error = $3,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = $1 AND status = 'UNKNOWN' AND row_version = $4
             RETURNING id, stage_attempt_id, provider_key, status, row_version,
                       request_fingerprint, normalized_result_json, result_fingerprint,
                       next_reconcile_at, reconcile_attempts, last_reconcile_error
            """,
            operation.id,
            next_at,
            error[:2000],
            operation.row_version,
        )
        if row is None:
            raise NarrationProviderStateConflictError(str(operation.id))
        return self._operation(row)

    async def exhaust_provider_reconciliation(
        self, operation: DurableNarrationProviderOperation, error: str
    ) -> DurableNarrationProviderOperation:
        """Suspend UNKNOWN for explicit/manual attention without converting it to FAILED."""
        row = await self._require_pool().fetchrow(
            """
            UPDATE provider_operations
               SET next_reconcile_at = NULL,
                   reconcile_attempts = reconcile_attempts + 1,
                   last_reconcile_error = $2,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = $1 AND status = 'UNKNOWN' AND row_version = $3
             RETURNING id, stage_attempt_id, provider_key, status, row_version,
                       request_fingerprint, normalized_result_json, result_fingerprint,
                       next_reconcile_at, reconcile_attempts, last_reconcile_error
            """,
            operation.id,
            f"RECONCILIATION_EXHAUSTED: {error}"[:2000],
            operation.row_version,
        )
        if row is None:
            raise NarrationProviderStateConflictError(str(operation.id))
        return self._operation(row)

    async def mark_unknown(self, claimed: ClaimedNarrationJob, worker_id: str) -> bool:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                stage = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'UNKNOWN', updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if stage != "UPDATE 1":
                    return False
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'UNKNOWN', current_step = 'NARRATION_TTS_UNKNOWN',
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND status = 'RUNNING'
                    """,
                    claimed.generation_job_id,
                )
                return True

    async def mark_reconciliation_exhausted(
        self, claimed: ClaimedNarrationJob, worker_id: str, error_code: str
    ) -> bool:
        """Keep the operation UNKNOWN and expose that automatic reconciliation is exhausted."""
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                stage = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'UNKNOWN', updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if stage != "UPDATE 1":
                    return False
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'UNKNOWN', current_step = 'NARRATION_REQUIRES_ATTENTION',
                           error_code = $2, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status = 'RUNNING'
                    """,
                    claimed.generation_job_id,
                    error_code[:80],
                )
                return True

    async def mark_stalled(
        self, claimed: ClaimedNarrationJob, worker_id: str, error_code: str
    ) -> bool:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                stage = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'STALLED', updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if stage != "UPDATE 1":
                    return False
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'STALLED', current_step = 'NARRATION_RETRY',
                           error_code = $2, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status = 'RUNNING'
                    """,
                    claimed.generation_job_id,
                    error_code[:80],
                )
                return True

    async def fail(self, claimed: ClaimedNarrationJob, worker_id: str, error_code: str) -> None:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                stage = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if stage != "UPDATE 1":
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

    async def complete(
        self,
        claimed: ClaimedNarrationJob,
        worker_id: str,
        media_asset: StoredMediaAsset,
        *,
        duration_ms: int,
        sample_rate_hz: int,
        channels: int,
        spans: list[AlignmentSpan],
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
                    raise NarrationLeaseLostError("Worker no longer owns the narration lease")
                existing = await connection.fetchrow(
                    """
                    SELECT na.checksum, pa.storage_key
                      FROM narration_assets na
                      JOIN project_assets pa ON pa.id = na.project_asset_id
                     WHERE na.narration_request_id = $1
                    """,
                    claimed.narration_request_id,
                )
                if existing is not None:
                    if (
                        str(existing["checksum"]) != media_asset.checksum
                        or str(existing["storage_key"]) != media_asset.storage_key
                    ):
                        raise NarrationProviderStateConflictError(
                            "Narration final asset is immutable and differs from the retry result"
                        )
                    stage = await connection.execute(
                        """
                        UPDATE stage_attempts
                           SET status = 'COMPLETED', heartbeat_at = CURRENT_TIMESTAMP,
                               updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                         WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                        """,
                        claimed.stage_attempt_id,
                        worker_id,
                    )
                    if stage != "UPDATE 1":
                        raise NarrationLeaseLostError(
                            "Worker lost the narration lease before idempotent completion"
                        )
                    await connection.execute(
                        """
                        UPDATE generation_jobs
                           SET status = 'COMPLETED', progress = 100, current_step = 'COMPLETED',
                               error_code = NULL, updated_at = CURRENT_TIMESTAMP,
                               row_version = row_version + 1
                         WHERE id = $1 AND status = 'RUNNING'
                        """,
                        claimed.generation_job_id,
                    )
                    return
                project_asset_id = await connection.fetchval(
                    """
                    INSERT INTO project_assets
                        (project_id, name, asset_type, storage_key, mime_type, metadata_json)
                    VALUES ($1, $2, 'AUDIO', $3, 'audio/mpeg', $4::jsonb)
                    RETURNING id
                    """,
                    claimed.project_id,
                    f"Chapter {claimed.chapter_id} narration",
                    media_asset.storage_key,
                    json.dumps(
                        {
                            "sha256": media_asset.checksum,
                            "durationMs": duration_ms,
                            "narrationRequestId": str(claimed.narration_request_id),
                        },
                        separators=(",", ":"),
                    ),
                )
                narration_asset_id = uuid.uuid4()
                await connection.execute(
                    """
                    INSERT INTO narration_assets
                        (id, narration_request_id, project_asset_id, duration_ms, size_bytes,
                         codec, sample_rate_hz, channels, checksum)
                    VALUES ($1, $2, $3, $4, $5, 'mp3', $6, $7, $8)
                    """,
                    narration_asset_id,
                    claimed.narration_request_id,
                    project_asset_id,
                    duration_ms,
                    media_asset.size_bytes,
                    sample_rate_hz,
                    channels,
                    media_asset.checksum,
                )
                span_payload = [
                    {
                        "index": span.index,
                        "textStart": span.text_start,
                        "textEnd": span.text_end,
                        "audioStartMs": span.audio_start_ms,
                        "audioEndMs": span.audio_end_ms,
                    }
                    for span in spans
                ]
                await connection.execute(
                    """
                    INSERT INTO narration_alignments
                        (id, narration_asset_id, source_hash, alignment_version, spans_json)
                    VALUES ($1, $2, $3, 'segment-duration-v1', $4::jsonb)
                    """,
                    uuid.uuid4(),
                    narration_asset_id,
                    claimed.source_hash,
                    json.dumps(span_payload, separators=(",", ":")),
                )
                stage = await connection.execute(
                    """
                    UPDATE stage_attempts
                       SET status = 'COMPLETED', heartbeat_at = CURRENT_TIMESTAMP,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1 AND worker_id = $2 AND status = 'RUNNING'
                    """,
                    claimed.stage_attempt_id,
                    worker_id,
                )
                if stage != "UPDATE 1":
                    raise NarrationLeaseLostError(
                        "Worker lost the narration lease before completion"
                    )
                await connection.execute(
                    """
                    UPDATE generation_jobs
                       SET status = 'COMPLETED', progress = 100, current_step = 'COMPLETED',
                           error_code = NULL, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1 AND status = 'RUNNING'
                    """,
                    claimed.generation_job_id,
                )

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("NarrationWorkerRepository.connect() must be called before use")
        return self._pool

    @staticmethod
    def _operation(
        row: asyncpg.Record, *, created: bool = False
    ) -> DurableNarrationProviderOperation:
        raw = row["normalized_result_json"]
        result: dict[str, Any] | None = None
        if raw is not None:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
            result = dict(parsed)
        return DurableNarrationProviderOperation(
            id=row["id"],
            stage_attempt_id=row["stage_attempt_id"],
            provider_key=str(row["provider_key"]),
            status=ProviderOperationStatus(row["status"]),
            row_version=int(row["row_version"]),
            request_fingerprint=str(row["request_fingerprint"]),
            result=result,
            result_fingerprint=row["result_fingerprint"],
            next_reconcile_at=row["next_reconcile_at"],
            reconcile_attempts=int(row["reconcile_attempts"]),
            last_reconcile_error=row["last_reconcile_error"],
            created=created,
        )


def segment_request_fingerprint(
    claimed: ClaimedNarrationJob, provider_key: str, segment_index: int, segment_text: str
) -> str:
    payload = "|".join(
        (
            provider_key,
            str(claimed.narration_request_id),
            str(segment_index),
            claimed.source_hash,
            claimed.voice_id,
            claimed.language,
            str(claimed.speaking_rate),
            hashlib.sha256(segment_text.encode("utf-8")).hexdigest(),
        )
    )
    return hashlib.sha256(payload.encode()).hexdigest()
