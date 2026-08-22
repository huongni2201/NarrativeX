"""Durable batch image-generation worker."""

import asyncio
import contextlib
import logging
import uuid

from narrativex_worker.config import WorkerSettings
from narrativex_worker.image_generation_repository import (
    ClaimedImageGenerationJob,
    ImageGenerationRepository,
)
from narrativex_worker.image_generation_runner import ImageGenerationRunner
from narrativex_worker.narration.storage import MediaStorage, S3MediaStorage
from narrativex_worker.providers.factory import create_image_provider
from narrativex_worker.providers.image import ImageBatchItem, ImageBatchOperation
from narrativex_worker.schema import ProviderOperationStatus


class ImageGenerationWorkerRunner:
    STAGE_NAME = "SHOT_IMAGE_GENERATE"

    def __init__(
        self,
        settings: WorkerSettings,
        concurrency_gate: asyncio.Semaphore,
        *,
        repository: ImageGenerationRepository | None = None,
        storage: MediaStorage | None = None,
    ) -> None:
        self.settings = settings
        self.enabled = settings.image_provider_mode != "disabled"
        self.worker_id = f"{settings.worker_name}-image-{uuid.uuid4()}"
        self.repository = repository or ImageGenerationRepository(
            settings.database_url, settings.lease_seconds, settings
        )
        self.provider = create_image_provider(settings)
        self.storage = storage
        self._running = False
        self._tasks: set[asyncio.Task[None]] = set()
        self._concurrency_gate = concurrency_gate
        self.logger = logging.getLogger("narrativex.image-generation")

    def stop(self) -> None:
        self._running = False

    async def start(self, *, dry_run: bool = False) -> None:
        if not self.enabled:
            self.logger.info("Image generation worker disabled (IMAGE_PROVIDER_MODE=disabled)")
            return
        if dry_run:
            self.logger.info("Image generation worker dry run completed")
            return
        if self.storage is None:
            self.storage = S3MediaStorage(self.settings)
        await self.repository.connect()
        self._running = True
        try:
            while self._running:
                self._tasks = {task for task in self._tasks if not task.done()}
                if len(self._tasks) >= self.settings.worker_concurrency:
                    await asyncio.wait(self._tasks, return_when=asyncio.FIRST_COMPLETED)
                    continue
                await self._reconcile_due()
                claimed = await self.repository.claim_next(self.worker_id)
                if claimed is None:
                    if self._tasks:
                        await asyncio.wait(
                            self._tasks,
                            timeout=self.settings.poll_interval_seconds,
                            return_when=asyncio.FIRST_COMPLETED,
                        )
                    else:
                        await asyncio.sleep(self.settings.poll_interval_seconds)
                    continue
                task = asyncio.create_task(self._process(claimed))
                self._tasks.add(task)
        finally:
            for task in self._tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*self._tasks, return_exceptions=True)
            await self.repository.close()
            aclose = getattr(self.provider, "aclose", None)
            if aclose is not None:
                await aclose()

    async def _process(self, job: ClaimedImageGenerationJob) -> None:
        heartbeat = asyncio.create_task(self._heartbeat(job))
        try:
            async with self._concurrency_gate:
                pending = await self.repository.load_pending_items(job)
                if not pending:
                    return
                items = [ImageBatchItem(item.item_key, item.request) for item in pending]
                for batch in _partition_batches(items, self.settings.vertex_image_batch_max_items):
                    await self._submit_batch(job, batch)
        except asyncio.CancelledError:
            raise
        except Exception:
            self.logger.exception("Image generation job failed job=%s", job.generation_job_id)
            # A provider exception is deliberately UNKNOWN: the provider may have accepted it.
        finally:
            heartbeat.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await heartbeat

    async def _submit_batch(
        self, job: ClaimedImageGenerationJob, items: tuple[ImageBatchItem, ...]
    ) -> None:
        operation = await self.repository.reserve_provider_operation(job, items)
        if not operation.created:
            if operation.status is ProviderOperationStatus.RESERVED:
                await self.repository.mark_submission_unknown(operation)
            return
        await self.repository.bind_items_to_operation(job, operation)
        operation = await self.repository.mark_submission_unknown(operation)
        try:
            provider_operation = await self.provider.submit_batch(items)
        except Exception as exception:
            await self.repository.mark_unknown(operation, type(exception).__name__.upper())
            return
        await self.repository.mark_submitted(
            operation, provider_operation.operation_id, provider_operation.status
        )

    async def _reconcile_due(self) -> None:
        if self.storage is None:
            return
        for durable in await self.repository.due_operations(self.settings.worker_concurrency):
            operation = ImageBatchOperation(
                provider_key=durable.provider_key,
                operation_id=durable.provider_operation_id,
                status=durable.status,
                items=durable.items,
            )
            try:
                if durable.status is ProviderOperationStatus.UNKNOWN:
                    recover = getattr(self.provider, "recover_batch", None)
                    if recover is None:
                        await self.repository.mark_unknown(durable, "PROVIDER_RECOVERY_UNSUPPORTED")
                        continue
                    resolved = await recover(operation)
                else:
                    resolved = await self.provider.reconcile_batch(operation)
                if resolved.status is ProviderOperationStatus.UNKNOWN:
                    await self.repository.mark_unknown(
                        durable, resolved.error_code or "PROVIDER_SUBMISSION_UNRESOLVED"
                    )
                    continue
                if resolved.status in {
                    ProviderOperationStatus.SUBMITTED,
                    ProviderOperationStatus.RUNNING,
                }:
                    await self.repository.mark_submitted(
                        durable, resolved.operation_id, resolved.status
                    )
                    continue
                if resolved.status is ProviderOperationStatus.FAILED:
                    for item in durable.items:
                        await self.repository.mark_failed(
                            item.item_key,
                            item.request.request_fingerprint,
                            resolved.error_code or "IMAGE_BATCH_PROVIDER_FAILED",
                        )
                    await self.repository.complete_batch(durable, ())
                    continue
                runner = ImageGenerationRunner(self.provider, self.storage, self.repository)
                materialized = await runner.materialize_batch(
                    resolved, durable_operation_id=durable.id
                )
                await self.repository.complete_batch(durable, materialized)
            except Exception as exception:
                await self.repository.mark_unknown(durable, type(exception).__name__.upper())

    async def _heartbeat(self, job: ClaimedImageGenerationJob) -> None:
        interval = max(3.0, self.settings.lease_seconds / 3)
        while True:
            await asyncio.sleep(interval)
            if not await self.repository.heartbeat(job):
                raise RuntimeError("Image generation lease was lost")


def _partition_batches(
    items: list[ImageBatchItem], max_items: int
) -> tuple[tuple[ImageBatchItem, ...], ...]:
    """Keep duplicate provider request bodies in separate batches.

    Vertex's JSONL response may echo identical instances without a stable item identity. A
    deterministic split is safer than positional assignment and still batches all unique bodies.
    """
    batches: list[tuple[ImageBatchItem, ...]] = []
    current: list[ImageBatchItem] = []
    identities: set[tuple[object, ...]] = set()
    current_model: str | None = None
    for item in sorted(items, key=lambda value: value.item_key):
        identity = (
            item.request.prompt,
            item.request.negative_prompt,
            item.request.aspect_ratio.value,
            item.request.quality_tier.value,
            item.request.model_key,
        )
        if current and (
            len(current) >= max_items
            or identity in identities
            or item.request.model_key != current_model
        ):
            batches.append(tuple(current))
            current = []
            identities = set()
            current_model = None
        current.append(item)
        identities.add(identity)
        current_model = item.request.model_key
    if current:
        batches.append(tuple(current))
    return tuple(batches)
