"""Stable image-generation repository facade."""

import hashlib
import json
from dataclasses import replace

from narrativex_worker.image_generation_repository.implementation import (
    ClaimedImageGenerationItem,
    ClaimedImageGenerationJob,
    DurableImageOperation,
    ImageGenerationLeaseLostError,
)
from narrativex_worker.image_generation_repository.implementation import (
    ImageGenerationRepository as ImageGenerationRepositoryImplementation,
)
from narrativex_worker.media_repository import DurableMediaResult
from narrativex_worker.providers.image import ImageBatchItem, ImageReference
from narrativex_worker.schema import ProviderOperationStatus


class ImageGenerationRepository(ImageGenerationRepositoryImplementation):
    """Public facade retained for existing worker and test consumers.

    Besides UNKNOWN terminalization, this facade owns reconstruction of immutable character
    reference inputs from the persisted media-plan snapshot. Provider adapters never query
    character/media-plan tables directly, and crash recovery reconstructs the exact same inputs.
    """

    async def load_pending_items(
        self, job: ClaimedImageGenerationJob
    ) -> tuple[ClaimedImageGenerationItem, ...]:
        items = await super().load_pending_items(job)
        if not items:
            await self.aggregate_generation_job(job.stage_attempt_id)
            return ()
        snapshots = await self._reference_snapshots_for_job(job.generation_job_id)
        return tuple(
            replace(
                item,
                request=replace(
                    item.request,
                    references=_parse_image_references(snapshots.get(item.item_key)),
                ),
            )
            for item in items
        )

    async def _items_for_operation(self, operation_id: int) -> tuple[ImageBatchItem, ...]:
        items = await super()._items_for_operation(operation_id)
        snapshots = await self._reference_snapshots_for_operation(operation_id)
        return tuple(
            ImageBatchItem(
                item.item_key,
                replace(
                    item.request,
                    references=_parse_image_references(snapshots.get(item.item_key)),
                ),
            )
            for item in items
        )

    async def _reference_snapshots_for_job(self, generation_job_id: int) -> dict[str, str | None]:
        rows = await self._require_pool().fetch(
            """
            SELECT mgi.item_key, mbp.character_snapshot_json::text AS character_snapshot_json
              FROM media_generation_items mgi
              JOIN media_beat_plans mbp
                ON mbp.media_plan_id = mgi.media_plan_id
               AND mbp.visual_beat_id = mgi.visual_beat_id
             WHERE mgi.generation_job_id = $1
            """,
            generation_job_id,
        )
        return {row["item_key"]: row["character_snapshot_json"] for row in rows}

    async def _reference_snapshots_for_operation(self, operation_id: int) -> dict[str, str | None]:
        rows = await self._require_pool().fetch(
            """
            SELECT mgi.item_key, mbp.character_snapshot_json::text AS character_snapshot_json
              FROM media_generation_items mgi
              JOIN media_beat_plans mbp
                ON mbp.media_plan_id = mgi.media_plan_id
               AND mbp.visual_beat_id = mgi.visual_beat_id
             WHERE mgi.provider_operation_id = $1
            """,
            operation_id,
        )
        return {row["item_key"]: row["character_snapshot_json"] for row in rows}

    async def mark_submitted(
        self,
        operation: DurableImageOperation,
        provider_operation_id: str | None,
        status: ProviderOperationStatus,
    ) -> DurableImageOperation:
        if status not in {
            ProviderOperationStatus.SUBMITTED,
            ProviderOperationStatus.RUNNING,
        }:
            raise ValueError(f"invalid submitted status: {status}")

        row = await self._require_pool().fetchrow(
            """
            UPDATE provider_operations
               SET status = CASE
                       WHEN status = 'RUNNING' AND $2 = 'SUBMITTED' THEN 'RUNNING'
                       ELSE $2
                   END,
                   provider_operation_id = COALESCE(provider_operation_id, $3),
                   next_reconcile_at = CURRENT_TIMESTAMP + INTERVAL '15 seconds',
                   last_reconcile_error = NULL,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = $1
               AND status IN ('RESERVED', 'UNKNOWN', 'SUBMITTED', 'RUNNING')
               AND row_version = $4
               AND (provider_operation_id IS NULL OR $3::text IS NULL OR provider_operation_id = $3)
               AND (
                   ($5::text IS NULL AND $6::uuid IS NULL)
                   OR EXISTS (
                       SELECT 1
                         FROM stage_attempts sa
                        WHERE sa.id = provider_operations.stage_attempt_id
                          AND sa.worker_id = $5
                          AND sa.lease_token = $6::uuid
                          AND sa.status = 'RUNNING'
                   )
               )
            RETURNING id, stage_attempt_id, provider_key, request_fingerprint,
                      provider_operation_id, status, row_version
            """,
            operation.id,
            status.value,
            provider_operation_id,
            operation.row_version,
            operation.worker_id,
            operation.lease_token,
        )
        if row is None:
            raise ImageGenerationLeaseLostError(
                "Image provider operation changed, provider id conflicted, or lease was lost "
                "before provider progress was persisted"
            )
        return self._operation(row, operation.items, owner=operation)

    async def fail_provider_operation(
        self, operation: DurableImageOperation, error_code: str
    ) -> bool:
        pool = self._require_pool()
        error = error_code[:2000]
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    UPDATE provider_operations
                       SET status = 'FAILED',
                           last_reconcile_error = $2,
                           completed_at = CURRENT_TIMESTAMP,
                           next_reconcile_at = NULL,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status IN ('RESERVED', 'UNKNOWN', 'SUBMITTED', 'RUNNING')
                       AND row_version = $3
                       AND (
                           ($4::text IS NULL AND $5::uuid IS NULL)
                           OR EXISTS (
                               SELECT 1
                                 FROM stage_attempts sa
                                WHERE sa.id = provider_operations.stage_attempt_id
                                  AND sa.worker_id = $4
                                  AND sa.lease_token = $5::uuid
                                  AND sa.status = 'RUNNING'
                           )
                       )
                    RETURNING id
                    """,
                    operation.id,
                    error,
                    operation.row_version,
                    operation.worker_id,
                    operation.lease_token,
                )
                if row is None:
                    return False
                await connection.execute(
                    """
                    UPDATE media_generation_items
                       SET execution_status = 'FAILED',
                           error_code = $2,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE provider_operation_id = $1
                       AND execution_status NOT IN ('READY', 'FAILED')
                    """,
                    operation.id,
                    error[:80],
                )
                await self._aggregate_generation_job(connection, operation.stage_attempt_id)
                return True

    async def complete_provider_operation(
        self, operation: DurableImageOperation, results: tuple[DurableMediaResult, ...]
    ) -> None:
        normalized_items = [
            {
                "itemKey": result.item_key,
                "sha256": result.checksum.lower(),
                "storageKey": result.storage_key,
                "mimeType": result.mime_type,
                "width": result.width,
                "height": result.height,
            }
            for result in results
        ]
        if any(item["itemKey"] is None for item in normalized_items):
            raise ValueError("durable image result is missing item_key")
        normalized_items.sort(key=lambda item: str(item["itemKey"]))
        summary = json.dumps(
            {"items": normalized_items}, sort_keys=True, separators=(",", ":")
        )
        fingerprint = hashlib.sha256(summary.encode()).hexdigest()
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    UPDATE provider_operations
                       SET status = 'COMPLETED', normalized_result_json = $2::jsonb,
                           result_fingerprint = $3,
                           completed_at = CURRENT_TIMESTAMP,
                           next_reconcile_at = NULL, updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status IN ('UNKNOWN', 'SUBMITTED', 'RUNNING')
                       AND row_version = $4
                       AND (
                           ($5::text IS NULL AND $6::uuid IS NULL)
                           OR EXISTS (
                               SELECT 1
                                 FROM stage_attempts sa
                                WHERE sa.id = provider_operations.stage_attempt_id
                                  AND sa.worker_id = $5
                                  AND sa.lease_token = $6::uuid
                                  AND sa.status = 'RUNNING'
                           )
                       )
                    RETURNING id
                    """,
                    operation.id,
                    summary,
                    fingerprint,
                    operation.row_version,
                    operation.worker_id,
                    operation.lease_token,
                )
                if row is None:
                    raise ImageGenerationLeaseLostError(
                        "Image provider operation changed or stage lease was lost before completion was persisted"
                    )
                await self._aggregate_generation_job(connection, operation.stage_attempt_id)

    async def mark_unknown(self, operation: DurableImageOperation, error: str) -> bool:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    UPDATE provider_operations
                       SET status = CASE
                               WHEN provider_operation_id IS NULL
                                AND reserved_at <= CURRENT_TIMESTAMP - ($4 * INTERVAL '1 second')
                               THEN 'FAILED'
                               ELSE 'UNKNOWN'
                           END,
                           completed_at = CASE
                               WHEN provider_operation_id IS NULL
                                AND reserved_at <= CURRENT_TIMESTAMP - ($4 * INTERVAL '1 second')
                               THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
                               ELSE completed_at
                           END,
                           next_reconcile_at = CASE
                               WHEN provider_operation_id IS NULL
                                AND reserved_at <= CURRENT_TIMESTAMP - ($4 * INTERVAL '1 second')
                               THEN NULL
                               ELSE CURRENT_TIMESTAMP + INTERVAL '15 seconds'
                           END,
                           last_reconcile_error = CASE
                               WHEN provider_operation_id IS NULL
                                AND reserved_at <= CURRENT_TIMESTAMP - ($4 * INTERVAL '1 second')
                               THEN 'PROVIDER_SUBMISSION_UNRESOLVED'
                               ELSE $2
                           END,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND status IN ('RESERVED', 'SUBMITTED', 'RUNNING', 'UNKNOWN')
                       AND row_version = $3
                       AND (
                           ($5::text IS NULL AND $6::uuid IS NULL)
                           OR EXISTS (
                               SELECT 1
                                 FROM stage_attempts sa
                                WHERE sa.id = provider_operations.stage_attempt_id
                                  AND sa.worker_id = $5
                                  AND sa.lease_token = $6::uuid
                                  AND sa.status = 'RUNNING'
                           )
                       )
                    RETURNING status
                    """,
                    operation.id,
                    error[:2000],
                    operation.row_version,
                    self.settings.vertex_image_unknown_max_age_seconds,
                    operation.worker_id,
                    operation.lease_token,
                )
                if row is None:
                    return False

                if row["status"] == "FAILED":
                    await connection.execute(
                        """
                        UPDATE media_generation_items
                           SET execution_status = 'FAILED',
                               error_code = 'PROVIDER_SUBMISSION_UNRESOLVED',
                               updated_at = CURRENT_TIMESTAMP,
                               row_version = row_version + 1
                         WHERE provider_operation_id = $1
                           AND execution_status NOT IN ('READY', 'FAILED')
                        """,
                        operation.id,
                    )
                    await self._aggregate_generation_job(connection, operation.stage_attempt_id)
                return True


def _parse_image_references(snapshot_json: str | None) -> tuple[ImageReference, ...]:
    if not snapshot_json:
        return ()
    try:
        payload = json.loads(snapshot_json)
    except (TypeError, json.JSONDecodeError):
        return ()
    if not isinstance(payload, dict):
        return ()
    characters = payload.get("characters")
    if not isinstance(characters, list):
        return ()

    references: list[ImageReference] = []
    seen: set[str] = set()
    for character in characters:
        if not isinstance(character, dict):
            continue
        character_name = character.get("canonicalName")
        name = character_name if isinstance(character_name, str) and character_name else "character"
        raw_references = character.get("references")
        if not isinstance(raw_references, list):
            continue
        for raw in raw_references:
            if not isinstance(raw, dict):
                continue
            asset_id = raw.get("assetId")
            storage_key = raw.get("storageKey")
            mime_type = raw.get("contentType")
            sha256 = raw.get("sha256")
            role = raw.get("role")
            if not all(isinstance(value, str) and value for value in (asset_id, storage_key, mime_type, sha256)):
                continue
            if not mime_type.startswith("image/") or len(sha256) != 64:
                continue
            if asset_id in seen:
                continue
            seen.add(asset_id)
            references.append(
                ImageReference(
                    asset_id=asset_id,
                    character_name=name,
                    role=role if isinstance(role, str) and role else "IDENTITY",
                    storage_key=storage_key,
                    mime_type=mime_type,
                    sha256=sha256.lower(),
                )
            )
    return tuple(references[:3])


__all__ = [
    "ClaimedImageGenerationItem",
    "ClaimedImageGenerationJob",
    "DurableImageOperation",
    "ImageGenerationLeaseLostError",
    "ImageGenerationRepository",
]
