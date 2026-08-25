"""Narration asset completion and durable materialization."""

import json
from typing import TYPE_CHECKING, Any

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.narration.errors import NarrationLeaseLostError
from narrativex_worker.narration.repository.implementation import (
    ClaimedNarrationJob,
    NarrationProviderStateConflictError,
)
from narrativex_worker.narration.storage import StoredMediaAsset
from narrativex_worker.uuid_v7 import uuid7


class NarrationCompletionMixin:
    if TYPE_CHECKING:
        def _require_pool(self) -> asyncpg.Pool: ...

    async def complete(
        self,
        claimed: ClaimedNarrationJob,
        worker_id: str,
        media_asset: StoredMediaAsset,
        *,
        duration_ms: int,
        sample_rate_hz: int,
        channels: int,
        spans: list[Any],
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
                narration_asset_id = uuid7()
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
                    uuid7(),
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


__all__ = ["NarrationCompletionMixin"]
