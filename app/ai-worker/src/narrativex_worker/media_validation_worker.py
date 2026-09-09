"""Durable validation worker for account-owned R2 voice-reference uploads."""

import asyncio
import contextlib
import logging
import uuid

from narrativex_worker.config import WorkerSettings
from narrativex_worker.media_validation import (
    MediaProbeTimeout,
    MediaValidationError,
    validate_media_file,
)
from narrativex_worker.media_validation_repository import (
    ClaimedMediaValidationJob,
    LeaseLostError,
    MediaValidationRepository,
)
from narrativex_worker.narration.storage import (
    MediaAssetConflictError,
    MediaDownloadLimitError,
    MediaStorage,
    S3MediaStorage,
)
from narrativex_worker.task_runtime import reap_finished_tasks
from narrativex_worker.workspace import WorkerWorkspace


class MediaValidationWorkerRunner:
    """Validate uploaded voice-reference audio before it becomes READY."""

    def __init__(
        self,
        settings: WorkerSettings,
        concurrency_gate: asyncio.Semaphore | None = None,
        storage: MediaStorage | None = None,
        repository: MediaValidationRepository | None = None,
        workspace: WorkerWorkspace | None = None,
    ) -> None:
        self.settings = settings
        self.enabled = True
        self.worker_id = f"{settings.worker_name}-voice-validation-{uuid.uuid4()}"
        self.repository = repository or MediaValidationRepository(
            settings.database_url,
            lease_seconds=settings.lease_seconds,
            pool_size=max(3, settings.worker_concurrency + 1),
        )
        self.storage = storage
        self.workspace = workspace or WorkerWorkspace()
        self._running = False
        self._in_flight: set[asyncio.Task[None]] = set()
        self._concurrency_gate = concurrency_gate or asyncio.Semaphore(settings.worker_concurrency)
        self.logger = logging.getLogger("narrativex.voice-reference-validation")

    def stop(self) -> None:
        self._running = False

    async def start(self, *, dry_run: bool = False) -> None:
        if dry_run:
            if self.storage is None:
                self.settings.require_voice_reference_r2()
            self.logger.info("Voice-reference validation worker dry run completed")
            return
        if self.storage is None:
            self.storage = S3MediaStorage(self.settings)
        await self.repository.connect()
        self._running = True
        try:
            while self._running:
                reap_finished_tasks(
                    self._in_flight,
                    self.logger,
                    worker_id=self.worker_id,
                    task_label="Voice-reference validation",
                )
                if len(self._in_flight) >= self.settings.worker_concurrency:
                    await asyncio.wait(self._in_flight, return_when=asyncio.FIRST_COMPLETED)
                    continue
                claimed = await self.repository.claim_next(self.worker_id)
                if claimed is None:
                    await asyncio.sleep(self.settings.poll_interval_seconds)
                    continue
                task = asyncio.create_task(self._process(claimed))
                self._in_flight.add(task)
        finally:
            if self._in_flight:
                await asyncio.gather(*self._in_flight, return_exceptions=True)
                self._in_flight.clear()
            await self.repository.close()

    async def _process(self, job: ClaimedMediaValidationJob) -> None:
        assert self.storage is not None
        heartbeat = asyncio.create_task(self._heartbeat(job))
        try:
            try:
                async with self._concurrency_gate:
                    await self._validate(job)
            except MediaProbeTimeout as exception:
                await self.repository.retry_or_fail(job, self.worker_id, str(exception))
            except MediaValidationError as exception:
                await self.repository.complete(
                    job,
                    self.worker_id,
                    status="REJECTED",
                    error_code=str(exception).split(":", 1)[0],
                    error_detail=str(exception),
                )
            except (FileNotFoundError, TimeoutError) as exception:
                await self.repository.retry_or_fail(
                    job, self.worker_id, type(exception).__name__.upper()
                )
            except (MediaDownloadLimitError, MediaAssetConflictError) as exception:
                await self.repository.complete(
                    job,
                    self.worker_id,
                    status="REJECTED",
                    error_code=type(exception).__name__.upper(),
                    error_detail=str(exception),
                )
            except LeaseLostError:
                raise
            except Exception:
                self.logger.exception(
                    "Unexpected voice-reference validation failure job=%s", job.id
                )
                await self.repository.retry_or_fail(
                    job, self.worker_id, "VALIDATION_INFRASTRUCTURE_ERROR"
                )
        except LeaseLostError:
            self.logger.warning(
                "Voice-reference validation lease lost; discarding result job=%s worker=%s",
                job.id,
                self.worker_id,
            )
        finally:
            if not heartbeat.done():
                heartbeat.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await heartbeat

    async def _validate(self, job: ClaimedMediaValidationJob) -> None:
        assert self.storage is not None
        if job.declared_type.strip().upper() != "AUDIO":
            raise MediaValidationError("VOICE_REFERENCE_AUDIO_REQUIRED")
        if not job.storage_key.startswith("voices/"):
            raise MediaValidationError("VOICE_REFERENCE_STORAGE_KEY_REQUIRED")

        async with self.workspace.create_job_dir(str(job.media_asset_id)) as directory:
            object_path = directory / "voice-reference.bin"
            await asyncio.wait_for(
                self.storage.download_to_file(
                    job.storage_key,
                    object_path,
                    expected_size=job.expected_size_bytes,
                    expected_checksum=job.expected_sha256,
                    max_bytes=self.settings.media_max_audio_bytes,
                ),
                timeout=self.settings.media_download_timeout_seconds,
            )
            validated = await asyncio.to_thread(
                lambda: validate_media_file(
                    object_path,
                    "AUDIO",
                    job.declared_content_type,
                    probe_timeout_seconds=self.settings.media_probe_timeout_seconds,
                )
            )
            await self.repository.complete(
                job,
                self.worker_id,
                status="READY",
                detected_content_type=validated.detected_content_type,
                detected_container=validated.detected_container,
                detected_codec=validated.detected_codec,
                width=None,
                height=None,
                duration_ms=validated.duration_ms,
            )

    async def _heartbeat(self, job: ClaimedMediaValidationJob) -> None:
        interval = max(3.0, self.settings.lease_seconds / 3)
        while True:
            await asyncio.sleep(interval)
            if not await self.repository.heartbeat(job.id, self.worker_id, job.lease_token):
                raise LeaseLostError("voice-reference validation lease was lost")
