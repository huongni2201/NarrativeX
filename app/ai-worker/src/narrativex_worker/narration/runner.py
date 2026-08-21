import asyncio
import contextlib
import logging
import time
import uuid
from pathlib import Path

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.alignment import NarrationAlignmentValidator, build_alignment
from narrativex_worker.narration.audio import FfmpegAudioAssembler
from narrativex_worker.narration.models import (
    MaterializedAudioSegment,
    NarrationSegment,
    SynthesizedSegment,
)
from narrativex_worker.narration.pricing import GoogleTtsPricingCatalog, TtsPricingSnapshot
from narrativex_worker.narration.providers import (
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
from narrativex_worker.narration.storage import MediaStorage, S3MediaStorage
from narrativex_worker.providers.tts import GoogleCloudTtsProvider
from narrativex_worker.schema import ProviderOperationStatus
from narrativex_worker.task_runtime import reap_finished_tasks
from narrativex_worker.workspace import WorkerWorkspace, sha256_file


class NarrationWorkerRunner:
    def __init__(self, settings: WorkerSettings) -> None:
        self.settings = settings
        self.logger = logging.getLogger("narrativex.worker.narration")
        self.worker_id = f"{settings.worker_name}-narration-{uuid.uuid4()}"
        self._running = False
        self._in_flight: set[asyncio.Task[None]] = set()
        self.enabled = settings.tts_provider_mode != "disabled"
        self.repository = NarrationWorkerRepository(
            settings.database_url,
            settings.lease_seconds,
            pool_size=max(5, settings.worker_concurrency + 2),
        )
        self.provider: TtsProvider | None = None
        self.storage: MediaStorage | None = None
        self.pricing: GoogleTtsPricingCatalog | None = None
        if self.enabled:
            self.provider = GoogleCloudTtsProvider(settings)
            self.storage = S3MediaStorage(settings)
            self.pricing = GoogleTtsPricingCatalog(settings.tts_pricing_catalog_version)
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
            # stop() only stops new claims. Existing jobs retain their lease/heartbeat and
            # are allowed to finish before the repository pool is closed.
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
        processing = asyncio.create_task(self._execute(claimed))
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
        except NarrationOutcomeUnknownError:
            self.logger.warning(
                "Narration job=%s stageAttemptId=%s narrationRequestId=%s "
                "has an UNKNOWN provider outcome",
                claimed.job_id,
                claimed.stage_attempt_id,
                claimed.narration_request_id,
            )
            with contextlib.suppress(Exception):
                await self.repository.mark_unknown(claimed, self.worker_id)
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

    async def _execute(self, claimed: ClaimedNarrationJob) -> None:
        assert self.provider is not None
        assert self.storage is not None
        assert self.pricing is not None
        pricing = self.pricing.resolve(claimed.voice_id)
        async with self.workspace.create_job_dir(str(claimed.narration_request_id)) as job_dir:
            self.logger.debug(
                "Narration workspace created job=%s request=%s",
                claimed.job_id,
                claimed.narration_request_id,
            )
            segments = self.segmenter.segment(claimed.source_text)
            materialized: list[MaterializedAudioSegment] = []
            for segment in segments:
                materialized.append(
                    await self._materialize_segment(claimed, segment, pricing, job_dir)
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
            media_asset = await self.storage.put_file_immutable(
                storage_key=final_key,
                file_path=mp3_path,
                checksum=checksum,
                mime_type="audio/mpeg",
                metadata={"duration-ms": str(actual_duration_ms)},
            )
            self.logger.debug(
                "Narration upload completed request=%s sizeBytes=%s checksum=%s",
                claimed.narration_request_id,
                mp3_path.stat().st_size,
                checksum,
            )
            await self.repository.complete(
                claimed,
                self.worker_id,
                media_asset,
                duration_ms=actual_duration_ms,
                sample_rate_hz=48000,
                channels=1,
                spans=spans,
            )
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
        pricing: TtsPricingSnapshot,
        job_dir: Path,
    ) -> MaterializedAudioSegment:
        assert self.provider is not None
        assert self.storage is not None
        storage_key = f"narration/{claimed.narration_request_id}/segments/{segment.index:04d}.pcm"
        fingerprint = segment_request_fingerprint(
            claimed, self.provider.provider_key, segment.index, segment.text
        )
        durable = await self.repository.reserve_provider_operation(
            claimed.stage_attempt_id, self.provider.provider_key, fingerprint
        )
        if durable.status is ProviderOperationStatus.COMPLETED:
            return await self._load_completed_segment(durable, segment, job_dir)
        if durable.status is ProviderOperationStatus.FAILED:
            raise RuntimeError(f"Narration segment {segment.index} previously failed")
        if durable.status is ProviderOperationStatus.UNKNOWN:
            stored = await self.storage.find(storage_key)
            if stored is None:
                raise NarrationOutcomeUnknownError(
                    f"Segment {segment.index} may have been accepted but has no durable audio"
                )
            recovered = await self._segment_from_storage(segment, stored.storage_key, job_dir)
            return await self._persist_segment_completion(
                durable, recovered, storage_key, stored.checksum, stored.size_bytes, pricing
            )
        if durable.status is not ProviderOperationStatus.RESERVED:
            raise NarrationOutcomeUnknownError(
                f"Unsupported narration provider state {durable.status.value}"
            )

        durable = await self.repository.fence_submission_unknown(durable)
        try:
            synthesized = await self.provider.synthesize(
                TtsRequest(
                    request_id=f"{claimed.narration_request_id}:segment:{segment.index:04d}",
                    segment=segment,
                    voice_id=claimed.voice_id,
                    language=claimed.language,
                    speaking_rate=claimed.speaking_rate,
                )
            )
        except TtsProviderRejectedError:
            await self.repository.fail_provider_operation(durable)
            raise
        except TtsProviderUnknownError as exception:
            raise NarrationOutcomeUnknownError(str(exception)) from exception

        self._validate_audio_format(synthesized)
        sample_rate_hz = synthesized.sample_rate_hz
        channels = synthesized.channels
        duration_ms = synthesized.duration_ms
        segment_path = job_dir / f"segment-{segment.index:04d}.pcm"
        with segment_path.open("wb") as output:
            output.write(synthesized.pcm_bytes)
        del synthesized
        checksum = await asyncio.to_thread(sha256_file, segment_path)
        stored = await self.storage.put_file_immutable(
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
            pricing,
        )

    async def _persist_segment_completion(
        self,
        durable: DurableNarrationProviderOperation,
        synthesized: MaterializedAudioSegment,
        storage_key: str,
        checksum: str,
        size_bytes: int,
        pricing: TtsPricingSnapshot,
    ) -> MaterializedAudioSegment:
        result = {
            "storageKey": storage_key,
            "checksum": checksum,
            "sizeBytes": size_bytes,
            "durationMs": synthesized.duration_ms,
            "sampleRateHz": synthesized.sample_rate_hz,
            "channels": synthesized.channels,
        }
        await self.repository.complete_provider_operation(
            durable,
            result,
            character_count=len(synthesized.segment.text),
            pricing=pricing,
        )
        return synthesized

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

    async def _heartbeat_loop(self, stage_attempt_id: int) -> None:
        interval = max(3.0, self.settings.lease_seconds / 3)
        while True:
            await asyncio.sleep(interval)
            if not await self.repository.heartbeat(stage_attempt_id, self.worker_id):
                raise NarrationLeaseLostError("Worker lost its narration StageAttempt lease")


class NarrationOutcomeUnknownError(RuntimeError):
    pass


class NarrationLeaseLostError(RuntimeError):
    pass
