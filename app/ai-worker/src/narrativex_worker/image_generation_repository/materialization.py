"""Durable media-asset materialization for generated image results."""

import json
import uuid

from narrativex_worker.image_generation_repository.core import ImageRepositoryMixin
from narrativex_worker.media_repository import DurableMediaResult
from narrativex_worker.providers.image import ImageGenerationResult
from narrativex_worker.uuid_v7 import uuid7


class ImageMaterializationMixin(ImageRepositoryMixin):
    async def finalize_image_result(
        self,
        *,
        operation_id: uuid.UUID | None,
        item_key: str,
        request_fingerprint: str,
        provider_operation_id: str | None,
        provider_result: ImageGenerationResult,
        stored: DurableMediaResult,
    ) -> DurableMediaResult:
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                row = await connection.fetchrow(
                    """
                    SELECT mgi.id, mgi.execution_status, mgi.media_asset_id,
                           mgi.request_fingerprint,
                           mgi.visual_beat_id, mgi.generation_job_id, mgi.media_plan_id,
                           gj.project_id, gj.requested_by_user_id, mp.chapter_id
                      FROM media_generation_items mgi
                      JOIN generation_jobs gj ON gj.id = mgi.generation_job_id
                      JOIN media_plans mp ON mp.id = mgi.media_plan_id
                     WHERE ($1::uuid IS NULL OR mgi.provider_operation_id = $1)
                       AND mgi.item_key = $2 AND mgi.request_fingerprint = $3
                     FOR UPDATE
                    """,
                    operation_id,
                    item_key,
                    request_fingerprint,
                )
                if row is None:
                    raise RuntimeError("IMAGE_GENERATION_ITEM_NOT_FOUND")
                if row["execution_status"] == "READY":
                    existing = await connection.fetchrow(
                        "SELECT sha256 FROM media_assets WHERE id = $1", row["media_asset_id"]
                    )
                    if existing and existing["sha256"] == stored.checksum:
                        return stored
                    raise RuntimeError("IMAGE_MATERIALIZATION_CONFLICT")

                # Project media is intentionally isolated. Do not reuse a media_asset row
                # from another project merely because the account/checksum matches.
                asset_id = uuid7()
                await connection.execute(
                    """
                    INSERT INTO media_assets
                        (id, account_id, project_id, asset_type, origin, storage_key,
                         original_filename, content_type, size_bytes, sha256, status, width,
                         height, checksum_verified_at)
                    VALUES ($1, $2, $3, 'IMAGE', 'IMAGE_GENERATED', $4, $5, $6,
                            $7, $8, 'READY', $9, $10, CURRENT_TIMESTAMP)
                    """,
                    asset_id,
                    row["requested_by_user_id"],
                    row["project_id"],
                    stored.storage_key,
                    f"{item_key}.png",
                    stored.mime_type,
                    len(provider_result.content),
                    stored.checksum,
                    stored.width,
                    stored.height,
                )
                await connection.execute(
                    """
                    INSERT INTO media_asset_lineage
                        (id, media_asset_id, account_id, project_id, chapter_id, visual_beat_id,
                         generation_job_id, media_plan_id, generation_item_id, relation_type,
                         request_fingerprint, result_fingerprint, prompt_snapshot,
                         provider_snapshot_json)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'GENERATED_KEYFRAME',
                            $10, $11, NULL, $12::jsonb)
                    ON CONFLICT (generation_item_id, relation_type) DO NOTHING
                    """,
                    uuid7(),
                    asset_id,
                    row["requested_by_user_id"],
                    row["project_id"],
                    row["chapter_id"],
                    row["visual_beat_id"],
                    row["generation_job_id"],
                    row["media_plan_id"],
                    row["id"],
                    request_fingerprint,
                    stored.checksum,
                    json.dumps(
                        {"providerOperationId": provider_operation_id}, separators=(",", ":")
                    ),
                )
                await connection.execute(
                    """
                    UPDATE media_generation_items
                       SET execution_status = 'READY', review_status = 'NEEDS_REVIEW',
                           media_asset_id = $2, error_code = NULL,
                           updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                     WHERE id = $1
                    """,
                    row["id"],
                    asset_id,
                )
                return stored
