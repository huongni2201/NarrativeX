"""Immutable character-reference reconstruction for the public image repository facade."""

import json
import uuid
from dataclasses import replace

from narrativex_worker.image_generation_repository.implementation import (
    ClaimedImageGenerationItem,
    ClaimedImageGenerationJob,
)
from narrativex_worker.providers.image import ImageBatchItem, ImageReference


class ImageReferenceFacadeMixin:
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

    async def _items_for_operation(self, operation_id: uuid.UUID) -> tuple[ImageBatchItem, ...]:
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

    async def _reference_snapshots_for_job(
        self, generation_job_id: uuid.UUID
    ) -> dict[str, str | None]:
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

    async def _reference_snapshots_for_operation(
        self, operation_id: uuid.UUID
    ) -> dict[str, str | None]:
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
            if not all(
                isinstance(value, str) and value
                for value in (asset_id, storage_key, mime_type, sha256)
            ):
                continue
            assert isinstance(asset_id, str)
            assert isinstance(storage_key, str)
            assert isinstance(mime_type, str)
            assert isinstance(sha256, str)
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
