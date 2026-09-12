import asyncio
import contextlib
import logging
import time
import uuid
from pathlib import Path
from typing import NoReturn

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.alignment import NarrationAlignmentValidator, build_alignment
from narrativex_worker.narration.audio import FfmpegAudioAssembler
from narrativex_worker.narration.errors import (
    NarrationLeaseLostError,
    NarrationOutcomeUnknownError,
    NarrationPermanentError,
    NarrationRetryableInfrastructureError,
    is_transient_infrastructure_error,
    retry_local_io,
)
from narrativex_worker.narration.models import (
    MaterializedAudioSegment,
    NarrationSegment,
    SynthesizedSegment,
)
from narrativex_worker.narration.providers import (
    FakeTtsProvider,
    TtsProvider,
    TtsProviderRejectedError,
    TtsProviderUnknownError,
    TtsRequest,
)
from narrativex_worker.narration.repository import (
    ClaimedNarrationJob,
    DurableNarrationProviderOperation,
    NarrationWorkerRepository,
    segment_request_fingerprint,
)
from narrativex_worker.narration.segmenter import NarrationSegmenter, utf16_length
from narrativex_worker.narration.storage import (
    LocalMediaStorage,
    MediaAssetConflictError,
    MediaStorage,
)
from narrativex_worker.narration.voice_reference import (
    VoiceReferenceAudioError,
    prepare_mp3_reference,
)
from narrativex_worker.observability import PipelineContext, PipelineMetrics
from narrativex_worker.providers.tts.vieneu import VieneuTtsProvider
from narrativex_worker.runtime.retry_policy import UNKNOWN_RECONCILIATION_POLICY
from narrativex_worker.schema import ProviderOperationStatus
from narrativex_worker.task_runtime import reap_finished_tasks
from narrativex_worker.workspace import WorkerWorkspace, sha256_file

__all__ = [
    "NarrationLeaseLostError",
    "NarrationOutcomeUnknownError",
    "NarrationWorkerRunner",
]


class NarrationWorkerRunner:
    def __init__(
        self, settings: WorkerSettings, concurrency_gate: asyncio.Semaphore | None = None
    ) -> None:
        self.settings = settings
        self.logger = logging.getLogger("narrativex.worker.narration")
        self.metrics = PipelineMetrics(self.logger)
        self.worker_id = f"{settings.worker_name}-narration-{uuid.uuid4()}"
        self._running = False
        self._in_flight: set[asyncio.Task[None]] = set()
        self._concurrency_gate = concurrency_gate or asyncio.Semaphore(settings.worker_concurrency)
        self.enabled = settings.tts_provider_mode != "disabled"
        self.repository = NarrationWorkerRepository(
            settings.database_url,
            settings.lease_seconds,
            pool_size=max(5, settings.worker_concurrency + 2),
        )
        self.provider: TtsProvider | None = None
        self.storage: MediaStorage | None = None
        if self.enabled:
            if settings.tts_provider_mode == "fake":
                self.provider = FakeTtsProvider()
            elif settings.tts_provider_mode == "vieneu":
                self.provider = VieneuTtsProvider(settings)
            else:
                raise RuntimeError(f"Unsupported TTS provider mode: {settings.tts_provider_mode}")
            self.storage = LocalMediaStorage(settings.project_media_local_dir)
        self.segmenter = NarrationSegmenter()
        self.validator = NarrationAlignmentValidator()
        self.audio = FfmpegAudioAssembler()
        self.workspace = WorkerWorkspace()

    async def start(self, *, dry_run: bool = False) -> None:
        if not self.enabled:
            self.logger.info("Narration worker disabled (TTS_PROVIDER_MODE=disabled)")
            return
        if dry_run:
            self.logger.info("Narration worker configuration verified")
            return
        await self.repository.connect()
        self._running = True
        try:
            while self._running:
                self._reap_finished_tasks()
                if len(self._in_flight) >= self.settings.worker_concurrency:
                    await asyncio.wait(self._in_flight, return_when=asyncio.FIRST_COMPLETED)
                    continue

                claim_started = time.monotonic()
                claimed = await self.repository.claim_due_reconciliation(self.worker_id)
                if claimed is None:
                    claimed = await self.repository.claim_next(self.worker_id)
                claim_latency = time.monotonic() - claim_started
                self.logger.debug(
                    "narration_claim_latency=%s narration_jobs_in_flight=%s",
                    claim_latency,
                    len(self._in_flight),
                )
                if claimed is None:
                    if self._in_flight:
                        done, _ = await asyncio.wait(
                            self._in_flight,
                            timeout=self.settings.poll_interval_seconds,
                            return_when=asyncio.FIRST_COMPLETED,
                        )
                        if done:
                            self._reap_finished_tasks()
                    else:
                        await asyncio.sleep(self.settings.poll_interval_seconds)
                    continue

                self.logger.info(
                    "Claimed narration job=%s stageAttemptId=%s narrationRequestId=%s "
                    "workerId=%s narration_worker_concurrency_limit=%s",
                    claimed.job_id,
                    claimed.stage_attempt_id,
                    claimed.narration_request_id,
                    self.worker_id,
                    self.settings.worker_concurrency,
                )
                task = asyncio.create_task(
                    self._process(claimed),
                    name=f"narration-job-{claimed.job_id}",
                )
                self._in_flight.add(task)
                self.logger.debug(
                    "narration_jobs_in_flight=%s workerId=%s",
                    len(self._in_flight),
                    self.worker_id,
                )
        finally:
            if self._in_flight:
                await asyncio.gather(*self._in_flight, return_exceptions=True)
                self._in_flight.clear()
            await self.repository.close()

    def _reap_finished_tasks(self) -> None:
        reap_finished_tasks(
            self._in_flight,
            self.logger,
            worker_id=self.worker_id,
            task_label="Narration",
        )

    def stop(self, *args: object) -> None:
        del args
        self.logger.info("Narration worker shutdown requested workerId=%s", self.worker_id)
        self._running = False

    async def _process(self, claimed: ClaimedNarrationJob) -> None:
        started_at = time.monotonic()
        context = PipelineContext(
            job_id=claimed.job_id,
            project_id=claimed.project_id,
            chapter_id=claimed.chapter_id,
        )
        processing = asyncio.create_task(self._execute_with_budget(claimed))
        heartbeat = asyncio.create_task(self._heartbeat_loop(claimed.stage_attempt_id))
        try:
            done, _ = await asyncio.wait(
                {processing, heartbeat}, return_when=asyncio.FIRST_COMPLETED
            )
            if heartbeat in done:
                await heartbeat
                raise NarrationLeaseLostError("Narration heartbeat stopped unexpectedly")
            await processing
        except NarrationLeaseLostError:
            self.logger.error(
                "Narration lease lost workerId=%s jobId=%s stageAttemptId=%s "
                "narrationRequestId=%s narration_lease_lost_total=1",
                self.worker_id,
                claimed.job_id,
                claimed.stage_attempt_id,
                claimed.narration_request_id,
            )
            if not processing.done():
                processing.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await processing
        except NarrationOutcomeUnknownError as exception:
            self.logger.warning(
                "Narration job=%s stageAttemptId=%s narrationRequestId=%s "
                "has an UNKNOWN provider outcome",
                claimed.job_id,
                claimed.stage_attempt_id,
                claimed.narration_request_id,
            )
            with contextlib.suppress(Exception):
                if exception.reconciliation_exhausted:
                    marked = await self.repository.mark_reconciliation_exhausted(
                        claimed, self.worker_id, "RECONCILIATION_EXHAUSTED"
                    )
                else:
                    marked = await self.repository.mark_unknown(claimed, self.worker_id)
                if not marked:
                    self.logger.info(
                        "Narration UNKNOWN transition skipped after lease loss jobId=%s",
                        claimed.job_id,
                    )
            if exception.provider_operation_id is not None:
                self.logger.warning(
                    "narration_outcome_unknown_total=1 providerOperationId=%s storageKey=%s",
                    exception.provider_operation_id,
                    exception.storage_key,
                )
        except NarrationRetryableInfrastructureError as exception:
            cause = exception.__cause__ or exception.__context__
            cause_type = type(cause).__name__ if cause is not None else "None"
            cause_message = str(cause) if cause is not None else "None"
            self.logger.warning(
                "narration_retryable_failure_total=1 jobId=%s stageAttemptId=%s "
                "errorType=%s message=%s underlyingType=%s underlying=%s",
                claimed.job_id,
                claimed.stage_attempt_id,
                type(exception).__name__,
                str(exception),
                cause_type,
                cause_message,
            )
            with contextlib.suppress(Exception):
                marked = await self.repository.mark_stalled(
                    claimed,
                    self.worker_id,
                    type(exception).__name__.upper()[:80],
                )
                if not marked:
                    self.logger.info(
                        "Narration retry transition skipped after lease loss jobId=%s",
                        claimed.job_id,
                    )
        except NarrationPermanentError as exception:
            self.logger.warning(
                "Narration permanent failure jobId=%s error=%s",
                claimed.job_id,
                type(exception).__name__,
            )
            with contextlib.suppress(Exception):
                await self.repository.fail(
                    claimed, self.worker_id, type(exception).__name__.upper()[:80]
                )
        except Exception as exception:
            self.logger.exception(
                "Narration job=%s stageAttemptId=%s narrationRequestId=%s failed",
                claimed.job_id,
                claimed.stage_attempt_id,
                claimed.narration_request_id,
            )
            with contextlib.suppress(Exception):
                await self.repository.fail(
                    claimed, self.worker_id, type(exception).__name__.upper()[:80]
                )
        finally:
            for task in (processing, heartbeat):
                if not task.done():
                    task.cancel()
            for task in (processing, heartbeat):
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task
            self.logger.debug(
                "Finished narration job=%s stageAttemptId=%s narrationRequestId=%s "
                "narration_job_duration=%s narration_jobs_in_flight=%s",
                claimed.job_id,
                claimed.stage_attempt_id,
                claimed.narration_request_id,
                time.monotonic() - started_at,
                len(self._in_flight),
            )
            self.metrics.duration("generation_job_duration", started_at, context)

    async def _execute_with_budget(self, claimed: ClaimedNarrationJob) -> None:
        async with self._concurrency_gate:
            started_at = time.monotonic()
            try:
                await self._execute(claimed)
            finally:
                self.metrics.duration(
                    "tts_duration",
                    started_at,
                    PipelineContext(
                        job_id=claimed.job_id,
                        project_id=claimed.project_id,
                        chapter_id=claimed.chapter_id,
                    ),
                )

    async def _execute(self, claimed: ClaimedNarrationJob) -> None:
        assert self.provider is not None
        assert self.storage is not None
        storage = self.storage
        async with self.workspace.create_job_dir(str(claimed.narration_request_id)) as job_dir:
            self.logger.debug(
                "Narration workspace created job=%s request=%s",
                claimed.job_id,
                claimed.narration_request_id,
            )
            reference_audio_path: Path | None = None
            if claimed.voice_reference_storage_key is not None:
                source_path = job_dir / "voice-reference.mp3"
                reference_audio_path = job_dir / "voice-reference.wav"
                try:
                    await retry_local_io(
                        lambda: storage.download_to_file(
                            claimed.voice_reference_storage_key or "", source_path
                        )
                    )
                except Exception as exception:
                    if is_transient_infrastructure_error(exception):
                        raise NarrationRetryableInfrastructureError(
                            "Voice reference storage is temporarily unavailable"
                        ) from exception
                    raise NarrationPermanentError(
                        "Voice reference audio could not be downloaded"
                    ) from exception
                try:
                    prepare_mp3_reference(source_path, reference_audio_path)
                except VoiceReferenceAudioError as exception:
                    raise NarrationPermanentError(str(exception)) from exception
            segments = self.segmenter.segment(claimed.source_text)
            materialized: list[MaterializedAudioSegment] = []
            for segment in segments:
                if reference_audio_path is None:
                    materialized.append(
                        await self._materialize_segment(claimed, segment, job_dir)
                    )
                else:
                    materialized.append(
                        await self._materialize_segment(
                            claimed, segment, job_dir, reference_audio_path
                        )
                    )

            pcm_path = job_dir / "chapter.pcm"
            await self.audio.concatenate_files([item.file_path for item in materialized], pcm_path)
            mp3_path = job_dir / "chapter.mp3"
            await self.audio.encode_mp3_file(pcm_path, mp3_path, sample_rate_hz=48000, channels=1)
            actual_duration_ms = await self.audio.probe_duration_ms_file(mp3_path)
            spans = build_alignment(materialized)
            self.validator.validate(
                spans,
                source_utf16_length=utf16_length(claimed.source_text),
                audio_duration_ms=actual_duration_ms,
            )
            checksum = await asyncio.to_thread(sha256_file, mp3_path)
            final_key = f"narration/{claimed.narration_request_id}/chapter.mp3"
            try:
                media_asset = await retry_local_io(
                    lambda: storage.put_file_immutable(
                        storage_key=final_key,
                        file_path=mp3_path,
                        checksum=checksum,
                        mime_type="audio/mpeg",
                        metadata={"duration-ms": str(actual_duration_ms)},
                    )
                )
            except MediaAssetConflictError as exception:
                raise NarrationPermanentError(str(exception)) from exception
            except Exception as exception:
                if is_transient_infrastructure_error(exception):
                    raise NarrationRetryableInfrastructureError(
                        "Final narration storage is temporarily unavailable"
                    ) from exception
                raise NarrationPermanentError(str(exception)) from exception
            self.logger.debug(
                "Narration upload completed request=%s sizeBytes=%s checksum=%s",
                claimed.narration_request_id,
                mp3_path.stat().st_size,
                checksum,
            )
            try:
                await retry_local_io(
                    lambda: self.repository.complete(
                        claimed,
                        self.worker_id,
                        media_asset,
                        duration_ms=actual_duration_ms,
                        sample_rate_hz=48000,
                        channels=1,
                        spans=spans,
                    )
                )
            except NarrationLeaseLostError:
                raise
            except Exception as exception:
                if is_transient_infrastructure_error(exception):
                    raise NarrationRetryableInfrastructureError(
                        "Narration completion is temporarily unavailable"
                    ) from exception
                raise NarrationPermanentError(str(exception)) from exception
            self.logger.info(
                "Completed narration job=%s request=%s durationMs=%s finalSizeBytes=%s",
                claimed.job_id,
                claimed.narration_request_id,
                actual_duration_ms,
                mp3_path.stat().st_size,
            )

    async def _materialize_segment(
        self,
        claimed: ClaimedNarrationJob,
        segment: NarrationSegment,
        job_dir: Path,
        reference_audio_path: Path | None = None,
    ) -> MaterializedAudioSegment:
        assert self.provider is not None
        assert self.storage is not None
        storage_key = f"narration/{claimed.narration_request_id}/segments/{segment.index:04d}.pcm"
        storage = self.storage
        fingerprint = segment_request_fingerprint(
            claimed, self.provider.provider_key, segment.index, segment.text
        )
        try:
            durable = await self.repository.reserve_provider_operation(
                claimed.stage_attempt_id, self.provider.provider_key, fingerprint
            )
        except Exception as exception:
            if is_transient_infrastructure_error(exception):
                raise NarrationRetryableInfrastructureError(
                    "Narration provider reservation is temporarily unavailable"
                ) from exception
            raise
        if durable.status is ProviderOperationStatus.COMPLETED:
            return await self._load_completed_segment(durable, segment, job_dir)
        if durable.status is ProviderOperationStatus.FAILED:
            raise NarrationPermanentError(f"Narration segment {segment.index} previously failed")
        if durable.status is ProviderOperationStatus.UNKNOWN:
            try:
                stored = await retry_local_io(lambda: storage.find(storage_key))
            except Exception as exception:
                if not is_transient_infrastructure_error(exception):
                    await self._raise_post_fence_permanent(durable, str(exception), storage_key)
                exhausted = await self._schedule_reconciliation(durable, str(exception))
                raise NarrationOutcomeUnknownError(
                    "Narration segment storage lookup is temporarily unavailable",
                    provider_operation_id=durable.id,
                    storage_key=storage_key,
                    reconciliation_exhausted=exhausted,
                ) from exception
            if stored is None:
                exhausted = await self._schedule_reconciliation(
                    durable,
                    f"segment {segment.index} durable audio is not visible in storage",
                )
                raise NarrationOutcomeUnknownError(
                    f"Segment {segment.index} may have been accepted but has no durable audio",
                    provider_operation_id=durable.id,
                    storage_key=storage_key,
                    reconciliation_exhausted=exhausted,
                )
            try:
                stored_key = stored.storage_key
                recovered = await retry_local_io(
                    lambda: self._segment_from_storage(segment, stored_key, job_dir)
                )
            except Exception as exception:
                if not is_transient_infrastructure_error(exception):
                    await self._raise_post_fence_permanent(durable, str(exception), storage_key)
                exhausted = await self._schedule_reconciliation(durable, str(exception))
                raise NarrationOutcomeUnknownError(
                    "Narration segment recovery is temporarily unavailable",
                    provider_operation_id=durable.id,
                    storage_key=storage_key,
                    reconciliation_exhausted=exhausted,
                ) from exception
            return await self._persist_segment_completion(
                durable, recovered, storage_key, stored.checksum, stored.size_bytes
            )
        if durable.status is not ProviderOperationStatus.RESERVED:
            raise NarrationOutcomeUnknownError(
                f"Unsupported narration provider state {durable.status.value}",
                provider_operation_id=durable.id,
                storage_key=storage_key,
            )

        try:
            durable = await self.repository.fence_submission_unknown(durable)
        except Exception as exception:
            if is_transient_infrastructure_error(exception):
                raise NarrationRetryableInfrastructureError(
                    "Narration submission fence is temporarily unavailable"
                ) from exception
            raise
        try:
            synthesized = await self.provider.synthesize(
                TtsRequest(
                    request_id=f"{claimed.narration_request_id}:segment:{segment.index:04d}",
                    segment=segment,
                    voice_id=claimed.voice_id,
                    language=claimed.language,
                    speaking_rate=claimed.speaking_rate,
                    reference_audio_path=reference_audio_path,
                )
            )
        except TtsProviderRejectedError as exception:
            await self._raise_post_fence_permanent(durable, str(exception), storage_key)
        except TtsProviderUnknownError as exception:
            exhausted = await self._schedule_reconciliation(durable, str(exception))
            raise NarrationOutcomeUnknownError(
                str(exception),
                provider_operation_id=durable.id,
                storage_key=storage_key,
                reconciliation_exhausted=exhausted,
            ) from exception
        except Exception as exception:
            if is_transient_infrastructure_error(exception):
                exhausted = await self._schedule_reconciliation(durable, str(exception))
                raise NarrationOutcomeUnknownError(
                    "Narration provider outcome is ambiguous",
                    provider_operation_id=durable.id,
                    storage_key=storage_key,
                    reconciliation_exhausted=exhausted,
                ) from exception
            await self._raise_post_fence_permanent(durable, str(exception), storage_key)

        try:
            self._validate_audio_format(synthesized)
        except (TypeError, ValueError) as exception:
            await self._raise_post_fence_permanent(durable, str(exception), storage_key)
        sample_rate_hz = synthesized.sample_rate_hz
        channels = synthesized.channels
        duration_ms = synthesized.duration_ms
        segment_path = job_dir / f"segment-{segment.index:04d}.pcm"
        try:
            with segment_path.open("wb") as output:
                output.write(synthesized.pcm_bytes)
            del synthesized
            checksum = await asyncio.to_thread(sha256_file, segment_path)
        except OSError as exception:
            exhausted = await self._schedule_reconciliation(durable, str(exception))
            raise NarrationOutcomeUnknownError(
                "Narration segment materialization is temporarily unavailable",
                provider_operation_id=durable.id,
                storage_key=storage_key,
                reconciliation_exhausted=exhausted,
            ) from exception
        try:
            stored = await retry_local_io(
                lambda: storage.put_file_immutable(
                    storage_key=storage_key,
                    file_path=segment_path,
                    checksum=checksum,
                    mime_type="audio/L16",
                    metadata={
                        "sample-rate-hz": str(sample_rate_hz),
                        "channels": str(channels),
                        "duration-ms": str(duration_ms),
                    },
                )
            )
        except Exception as exception:
            if not is_transient_infrastructure_error(exception):
                await self._raise_post_fence_permanent(durable, str(exception), storage_key)
            exhausted = await self._schedule_reconciliation(durable, str(exception))
            raise NarrationOutcomeUnknownError(
                "Narration segment storage is temporarily unavailable",
                provider_operation_id=durable.id,
                storage_key=storage_key,
                reconciliation_exhausted=exhausted,
            ) from exception
        return await self._persist_segment_completion(
            durable,
            MaterializedAudioSegment(
                segment=segment,
                file_path=segment_path,
                sample_rate_hz=sample_rate_hz,
                channels=channels,
                duration_ms=duration_ms,
                checksum=stored.checksum,
            ),
            storage_key,
            stored.checksum,
            stored.size_bytes,
        )

    async def _persist_segment_completion(
        self,
        durable: DurableNarrationProviderOperation,
        synthesized: MaterializedAudioSegment,
        storage_key: str,
        checksum: str,
        size_bytes: int,
    ) -> MaterializedAudioSegment:
        result = {
            "storageKey": storage_key,
            "checksum": checksum,
            "sizeBytes": size_bytes,
            "durationMs": synthesized.duration_ms,
            "sampleRateHz": synthesized.sample_rate_hz,
            "channels": synthesized.channels,
        }
        try:
            await retry_local_io(
                lambda: self.repository.complete_provider_operation(durable, result)
            )
        except Exception as exception:
            if not is_transient_infrastructure_error(exception):
                await self._raise_post_fence_permanent(durable, str(exception), storage_key)
            exhausted = await self._schedule_reconciliation(durable, str(exception))
            raise NarrationOutcomeUnknownError(
                "Narration provider completion is not durable yet",
                provider_operation_id=durable.id,
                storage_key=storage_key,
                reconciliation_exhausted=exhausted,
            ) from exception
        return synthesized

    async def _schedule_reconciliation(
        self, durable: DurableNarrationProviderOperation, error: str
    ) -> bool:
        try:
            if durable.reconcile_attempts >= UNKNOWN_RECONCILIATION_POLICY.max_attempts:
                await self.repository.exhaust_provider_reconciliation(durable, error)
                self.logger.error(
                    "narration_reconciliation_exhausted_total=1 providerOperationId=%s",
                    durable.id,
                )
                return True
            scheduled = await self.repository.schedule_provider_reconciliation(
                durable, error=error
            )
            self.logger.info(
                "narration_reconciliation_attempt_total=1 providerOperationId=%s "
                "reconcileAttempt=%s nextReconcileAt=%s",
                durable.id,
                scheduled.reconcile_attempts,
                scheduled.next_reconcile_at,
            )
            return False
        except Exception as exception:
            if is_transient_infrastructure_error(exception):
                raise NarrationRetryableInfrastructureError(
                    "Unable to schedule narration reconciliation"
                ) from exception
            raise

    async def _raise_post_fence_permanent(
        self,
        durable: DurableNarrationProviderOperation,
        message: str,
        storage_key: str,
    ) -> NoReturn:
        try:
            await self.repository.fail_provider_operation(durable)
        except Exception as persistence_exception:
            if is_transient_infrastructure_error(persistence_exception):
                exhausted = await self._schedule_reconciliation(
                    durable, f"permanent failure persistence failed: {persistence_exception}"
                )
                raise NarrationOutcomeUnknownError(
                    "Permanent narration failure could not be durably recorded",
                    provider_operation_id=durable.id,
                    storage_key=storage_key,
                    reconciliation_exhausted=exhausted,
                ) from persistence_exception
            raise NarrationOutcomeUnknownError(
                "Permanent narration failure could not be durably recorded",
                provider_operation_id=durable.id,
                storage_key=storage_key,
            ) from persistence_exception
        raise NarrationPermanentError(message)

    async def _load_completed_segment(
        self,
        durable: DurableNarrationProviderOperation,
        segment: NarrationSegment,
        job_dir: Path,
    ) -> MaterializedAudioSegment:
        if durable.result is None:
            raise RuntimeError("Completed narration provider operation has no durable result")
        storage_key = str(durable.result["storageKey"])
        synthesized = await self._segment_from_storage(segment, storage_key, job_dir)
        if synthesized.checksum != str(durable.result["checksum"]):
            raise RuntimeError("Durable narration segment checksum mismatch")
        return synthesized

    async def _segment_from_storage(
        self, segment: NarrationSegment, storage_key: str, job_dir: Path
    ) -> MaterializedAudioSegment:
        assert self.storage is not None
        stored = await self.storage.find(storage_key)
        if stored is None:
            raise RuntimeError(f"Durable narration segment {storage_key} is missing")
        segment_path = job_dir / f"segment-{segment.index:04d}.pcm"
        downloaded = await self.storage.download_to_file(storage_key, segment_path)
        if downloaded.checksum != stored.checksum:
            raise RuntimeError("Stored narration segment checksum mismatch")
        self.logger.debug(
            "Narration segment downloaded request=%s segment=%s sizeBytes=%s",
            storage_key.split("/")[1],
            segment.index,
            downloaded.size_bytes,
        )
        try:
            sample_rate_hz = int(stored.metadata["sample-rate-hz"])
            channels = int(stored.metadata["channels"])
            duration_ms = int(stored.metadata["duration-ms"])
        except (KeyError, ValueError) as exception:
            raise RuntimeError(
                "Stored narration segment audio metadata is incomplete"
            ) from exception
        if sample_rate_hz != 48000 or channels != 1:
            raise RuntimeError("Stored narration segment audio format is not 48kHz mono PCM")
        return MaterializedAudioSegment(
            segment=segment,
            file_path=segment_path,
            sample_rate_hz=sample_rate_hz,
            channels=channels,
            duration_ms=duration_ms,
            checksum=downloaded.checksum,
        )

    @staticmethod
    def _validate_audio_format(synthesized: SynthesizedSegment) -> None:
        if synthesized.sample_rate_hz != 48000 or synthesized.channels != 1:
            raise ValueError("narration segments must be 48kHz mono PCM")

    async def _heartbeat_loop(self, stage_attempt_id: uuid.UUID) -> None:
        interval = max(3.0, self.settings.lease_seconds / 3)
        while True:
            await asyncio.sleep(interval)
            if not await self.repository.heartbeat(stage_attempt_id, self.worker_id):
                raise NarrationLeaseLostError("Worker lost its narration StageAttempt lease")
