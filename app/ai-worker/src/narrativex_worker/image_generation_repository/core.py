"""Connection lifecycle and shared helpers for image-generation persistence."""

from typing import Any

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.config import WorkerSettings
from narrativex_worker.image_generation_repository.models import DurableImageOperation
from narrativex_worker.providers.image import ImageBatchItem
from narrativex_worker.schema import ProviderOperationStatus


class ImageRepositoryCore:
    def __init__(self, database_url: str, lease_seconds: int, settings: WorkerSettings) -> None:
        self.database_url = database_url
        self.lease_seconds = lease_seconds
        self.settings = settings
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                self.database_url,
                min_size=1,
                max_size=max(5, self.settings.worker_concurrency * 2 + 1),
            )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("ImageGenerationRepository is not connected")
        return self._pool

    @staticmethod
    def _operation(
        row: Any,
        items: tuple[ImageBatchItem, ...],
        *,
        owner: DurableImageOperation | None = None,
    ) -> DurableImageOperation:
        return DurableImageOperation(
            id=row["id"],
            stage_attempt_id=row["stage_attempt_id"],
            provider_key=row["provider_key"],
            request_fingerprint=row["request_fingerprint"],
            provider_operation_id=row["provider_operation_id"],
            status=ProviderOperationStatus(row["status"]),
            row_version=row["row_version"],
            items=items,
            worker_id=owner.worker_id if owner is not None else None,
            lease_token=owner.lease_token if owner is not None else None,
        )
