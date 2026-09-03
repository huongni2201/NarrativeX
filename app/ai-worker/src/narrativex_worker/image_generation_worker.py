"""Durable batch image-generation worker."""

import asyncio
import contextlib
import logging
import time
import uuid

from narrativex_worker.circuit_breaker import ProviderCircuitBreaker
from narrativex_worker.config import WorkerSettings
from narrativex_worker.image_generation_repository import (
    ClaimedImageGenerationJob,
    DurableImageOperation,
    ImageGenerationLeaseLostError,
    ImageGenerationRepository,
)
from narrativex_worker.image_generation_runner import (
    ImageGenerationOutputError,
    ImageGenerationProviderRejectedError,
    ImageGenerationRunner,
    ImageGenerationUnknownError,
)
from narrativex_worker.narration.storage import LocalMediaStorage, MediaStorage
from narrativex_worker.observability import PipelineContext, PipelineMetrics
from narrativex_worker.providers.factory import create_image_provider
from narrativex_worker.providers.image import ImageBatchItem, ImageBatchOperation
from narrativex_worker.providers.vertex_image import (
    VertexImageProviderError,
    VertexImageSubmissionUnknownError,
)
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
        self.storage = storage or LocalMediaStorage(settings.project_media_local_dir)
        self.provider = create_image_provider(settings, reference_store=self.storage)
        self._running = False
        self._tasks: set[asyncio.Task[None]] = set()
        self._concurrency_gate = concurrency_gate
        self.logger = logging.getLogger("narrativex.image-generation")
        self.metrics = PipelineMetrics(self.logger)
        self.circuit_breaker = ProviderCircuitBreaker(
            settings.image_circuit_breaker_failure_threshold,
            settings.image_circuit_breaker_open_seconds,
        )

    def stop(self) -> None:
        self._running = False

    async def start(self, *, dry_run: bool = False) -> None:
        if not self.enabled:
            self.logger.info("Image generation worker disabled (IMAGE_PROVIDER_MODE=disabled)")
            return
        if dry_run:
            self.logger.info("Image generation worker dry run completed")
            return
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
        started_at = time.monotonic()
        context = PipelineContext(
            job_id=job.generation_job_id,
            project_id=job.project_id,
            media_plan_id=str(job.media_plan_id),
        )
        processing = asyncio.create_task(self._process_claimed(job))
        heartbeat = asyncio.create_task(self._heartbeat(job))
        try:
            done, _ = await asyncio.wait(
                {processing, heartbeat}, return_when=asyncio.FIRST_COMPLETED
            )
            if heartbeat in done:
                await heartbeat
                raise ImageGenerationLeaseLostError(
                    "Image generation heartbeat stopped unexpectedly"
                )
            await processing
        except ImageGenerationLeaseLostError:
            self.logger.warning(
                "Image generation lease lost; cancelling processing job=%s worker=%s",
                job.generation_job_id,
                job.worker_id,
            )
            if not processing.done():
                processing.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await processing
        except asyncio.CancelledError:
            raise
        except Exception:
            self.logger.exception("Image generation job failed job=%s", job.generation_job_id)
        finally:
            metrics = getattr(self, "metrics", None)
            if metrics is not None:
                metrics.duration("image_generation_duration", started_at, context)
            for task in (processing, heartbeat):
                if not task.done():
                    task.cancel()
            for task in (processing, heartbeat):
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task

    async def _process_claimed(self, job: ClaimedImageGenerationJob) -> None:
        async with self._concurrency_gate:
            await self.repository.resolve_reused_items(job.stage_attempt_id)
            pending = await self.repository.load_pending_items(job)
            if not pending:
                await self.repository.aggregate_generation_job(job.stage_attempt_id)
                return
            items = [ImageBatchItem(item.item_key, item.request) for item in pending]
            for batch in _partition_batches(items, self.settings.vertex_image_batch_max_items):
                await self._submit_batch(job, batch)

    async def _submit_batch(
        self, job: ClaimedImageGenerationJob, items: tuple[ImageBatchItem, ...]
    ) -> None:
        operation = await self.repository.prepare_provider_submission(job, items)
        if not operation.created:
            return
        if not self.circuit_breaker.allow():
            self.logger.warning(
                "Image provider circuit is open; failing generation operation=%s job=%s",
                operation.id,
                job.generation_job_id,
            )
            await self.repository.fail_provider_operation(operation, "IMAGE_CIRCUIT_BREAKER_OPEN")
            return
        await self.repository.assert_lease(job)
        try:
            provider_operation = await self.provider.submit_batch(items)
        except VertexImageSubmissionUnknownError as exception:
            self._record_provider_failure(normalize_error(exception))
            await self.repository.mark_unknown(operation, normalize_error(exception))
            return
        except VertexImageProviderError as exception:
            self._record_provider_failure(normalize_error(exception))
            await self.repository.fail_provider_operation(operation, normalize_error(exception))
            return
        except Exception as exception:
            self.logger.exception(
                "Image batch submission failed without a classified provider outcome operation=%s",
                operation.id,
            )
            self._record_provider_failure(normalize_error(exception))
            await self.repository.mark_unknown(operation, normalize_error(exception))
            return
        if provider_operation.status is ProviderOperationStatus.FAILED:
            self._record_provider_failure(provider_operation.error_code or "IMAGE_PROVIDER_FAILED")
            await self.repository.fail_provider_operation(
                operation,
                provider_operation.error_code or "IMAGE_BATCH_PROVIDER_FAILED",
            )
            return
        self.circuit_breaker.record_success()
        try:
            await self.repository.mark_submitted(
                operation, provider_operation.operation_id, provider_operation.status
            )
        except ImageGenerationLeaseLostError:
            self.logger.warning(
                "Image batch submission returned after lease/state changed; leaving UNKNOWN "
                "for recovery operation=%s provider_operation_id=%s",
                operation.id,
                provider_operation.operation_id,
            )
        except Exception as exception:
            self.logger.exception(
                "Image batch submission persistence failed; leaving provider operation "
                "recoverable operation=%s provider_operation_id=%s",
                operation.id,
                provider_operation.operation_id,
            )
            with contextlib.suppress(Exception):
                await self.repository.mark_unknown(
                    operation,
                    f"PROVIDER_SUBMISSION_PERSISTENCE_UNKNOWN:{normalize_error(exception)}",
                )

    async def _fail_batch(self, operation: DurableImageOperation, error: str) -> None:
        await self.repository.fail_provider_operation(operation, error)

    async def _reconcile_due(self) -> None:
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
                    self._record_provider_failure(
                        resolved.error_code or "PROVIDER_SUBMISSION_UNRESOLVED"
                    )
                    await self.repository.mark_unknown(
                        durable, resolved.error_code or "PROVIDER_SUBMISSION_UNRESOLVED"
                    )
                    continue
                if resolved.status in {
                    ProviderOperationStatus.SUBMITTED,
                    ProviderOperationStatus.RUNNING,
                }:
                    self.circuit_breaker.record_success()
                    await self.repository.mark_submitted(
                        durable, resolved.operation_id, resolved.status
                    )
                    continue
                if resolved.status is ProviderOperationStatus.FAILED:
                    self._record_provider_failure(
                        resolved.error_code or "IMAGE_BATCH_PROVIDER_FAILED"
                    )
                    await self._fail_batch(
                        durable,
                        resolved.error_code or "IMAGE_BATCH_PROVIDER_FAILED",
                    )
                    continue
                runner = ImageGenerationRunner(self.provider, self.storage, self.repository)
                materialized = await runner.materialize_batch(
                    resolved, durable_operation_id=durable.id
                )
                await self.repository.complete_provider_operation(durable, materialized)
            except (VertexImageSubmissionUnknownError, ImageGenerationUnknownError) as exception:
                self._record_provider_failure(normalize_error(exception))
                await self.repository.mark_unknown(durable, normalize_error(exception))
            except VertexImageProviderError as exception:
                self._record_provider_failure(normalize_error(exception))
                await self.repository.fail_provider_operation(durable, normalize_error(exception))
            except (ImageGenerationOutputError, ImageGenerationProviderRejectedError) as exception:
                await self.repository.fail_provider_operation(durable, normalize_error(exception))
            except Exception as exception:
                self.logger.exception(
                    "Image batch reconciliation failed without a classified provider outcome "
                    "operation=%s",
                    durable.id,
                )
                await self.repository.mark_unknown(durable, normalize_error(exception))

    def _record_provider_failure(self, error: str) -> None:
        if self.circuit_breaker.record_failure():
            self.logger.error(
                "Image provider circuit opened after consecutive failures error=%s",
                error,
            )

    async def _heartbeat(self, job: ClaimedImageGenerationJob) -> None:
        interval = max(3.0, self.settings.lease_seconds / 3)
        while True:
            await asyncio.sleep(interval)
            if not await self.repository.heartbeat(job):
                raise ImageGenerationLeaseLostError("Image generation lease was lost")


def _partition_batches(
    items: list[ImageBatchItem], max_items: int
) -> tuple[tuple[ImageBatchItem, ...], ...]:
    """Keep duplicate provider request bodies in separate batches."""
    batches: list[tuple[ImageBatchItem, ...]] = []
    current: list[ImageBatchItem] = []
    identities: set[tuple[object, ...]] = set()
    current_model: str | None = None
    for item in sorted(items, key=lambda value: value.item_key):
        identity = (
            item.request.prompt,
            item.request.negative_prompt,
            item.request.aspect_ratio.value,
            item.request.model_key,
            tuple(
                (reference.asset_id, reference.sha256, reference.role)
                for reference in item.request.references
            ),
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


def normalize_error(exception: BaseException) -> str:
    message = str(exception).strip()
    return (message or type(exception).__name__).upper()[:80]
