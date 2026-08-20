import asyncio
import contextlib
import hashlib
import logging
import uuid

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.alignment import NarrationAlignmentValidator, build_alignment
from narrativex_worker.narration.audio import FfmpegAudioAssembler
from narrativex_worker.narration.models import NarrationSegment, SynthesizedSegment
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


class NarrationWorkerRunner:
    def __init__(self, settings: WorkerSettings) -> None:
        self.settings = settings
        self.logger = logging.getLogger("narrativex.worker.narration")
        self.worker_id = f"{settings.worker_name}-narration-{uuid.uuid4()}"
        self._running = False
        self.enabled = settings.tts_provider_mode != "disabled"
        self.repository = NarrationWorkerRepository(settings.database_url, settings.lease_seconds)
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
                claimed = await self.repository.claim_next(self.worker_id)
                if claimed is None:
                    await asyncio.sleep(self.settings.poll_interval_seconds)
                    continue
                await self._process(claimed)
        finally:
            await self.repository.close()

    def stop(self) -> None:
        self._running = False

    async def _process(self, claimed: ClaimedNarrationJob) -> None:
        processing = asyncio.create_task(self._execute(claimed))
        heartbeat = asyncio.create_task(self._heartbeat_loop(claimed.stage_attempt_id))
        try:
            done, _ = await asyncio.wait({processing, heartbeat}, return_when=asyncio.FIRST_COMPLETED)
            if heartbeat in done:
                await heartbeat
                raise RuntimeError("Narration heartbeat stopped unexpectedly")
            await processing
        except NarrationOutcomeUnknownError:
            self.logger.warning("Narration job=%s has an UNKNOWN provider outcome", claimed.job_id)
            with contextlib.suppress(Exception):
                await self.repository.mark_unknown(claimed, self.worker_id)
        except Exception as exception:
            self.logger.exception("Narration job=%s failed", claimed.job_id)
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

    async def _execute(self, claimed: ClaimedNarrationJob) -> None:
        assert self.provider is not None
        assert self.storage is not None
        assert self.pricing is not None
        pricing = self.pricing.resolve(claimed.voice_id)
        segments = self.segmenter.segment(claimed.source_text)
        synthesized: list[SynthesizedSegment] = []
        for segment in segments:
            synthesized.append(await self._materialize_segment(claimed, segment, pricing))

        pcm_bytes = b"".join(item.pcm_bytes for item in synthesized)
        mp3_bytes = await self.audio.encode_mp3(pcm_bytes, sample_rate_hz=48000, channels=1)
        actual_duration_ms = await self.audio.probe_duration_ms(mp3_bytes)
        spans = build_alignment(synthesized)
        self.validator.validate(
            spans,
            source_utf16_length=utf16_length(claimed.source_text),
            audio_duration_ms=actual_duration_ms,
        )
        checksum = hashlib.sha256(mp3_bytes).hexdigest()
        final_key = f"narration/{claimed.narration_request_id}/chapter.mp3"
        media_asset = await self.storage.put_immutable(
            storage_key=final_key,
            content=mp3_bytes,
            checksum=checksum,
            mime_type="audio/mpeg",
            metadata={"duration-ms": str(actual_duration_ms)},
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
            "Completed narration job=%s request=%s durationMs=%s",
            claimed.job_id,
            claimed.narration_request_id,
            actual_duration_ms,
        )

    async def _materialize_segment(
        self,
        claimed: ClaimedNarrationJob,
        segment: NarrationSegment,
        pricing: TtsPricingSnapshot,
    ) -> SynthesizedSegment:
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
            return await self._load_completed_segment(durable, segment)
        if durable.status is ProviderOperationStatus.FAILED:
            raise RuntimeError(f"Narration segment {segment.index} previously failed")
        if durable.status is ProviderOperationStatus.UNKNOWN:
            stored = await self.storage.find(storage_key)
            if stored is None:
                raise NarrationOutcomeUnknownError(
                    f"Segment {segment.index} may have been accepted but has no durable audio"
                )
            recovered = await self._segment_from_storage(segment, stored.storage_key)
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

        checksum = hashlib.sha256(synthesized.pcm_bytes).hexdigest()
        stored = await self.storage.put_immutable(
            storage_key=storage_key,
            content=synthesized.pcm_bytes,
            checksum=checksum,
            mime_type="audio/L16",
            metadata={
                "sample-rate-hz": str(synthesized.sample_rate_hz),
                "channels": str(synthesized.channels),
                "duration-ms": str(synthesized.duration_ms),
            },
        )
        return await self._persist_segment_completion(
            durable, synthesized, storage_key, stored.checksum, stored.size_bytes, pricing
        )

    async def _persist_segment_completion(
        self,
        durable: DurableNarrationProviderOperation,
        synthesized: SynthesizedSegment,
        storage_key: str,
        checksum: str,
        size_bytes: int,
        pricing: TtsPricingSnapshot,
    ) -> SynthesizedSegment:
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
        self, durable: DurableNarrationProviderOperation, segment: NarrationSegment
    ) -> SynthesizedSegment:
        if durable.result is None:
            raise RuntimeError("Completed narration provider operation has no durable result")
        storage_key = str(durable.result["storageKey"])
        synthesized = await self._segment_from_storage(segment, storage_key)
        checksum = hashlib.sha256(synthesized.pcm_bytes).hexdigest()
        if checksum != str(durable.result["checksum"]):
            raise RuntimeError("Durable narration segment checksum mismatch")
        return synthesized

    async def _segment_from_storage(
        self, segment: NarrationSegment, storage_key: str
    ) -> SynthesizedSegment:
        assert self.storage is not None
        stored = await self.storage.find(storage_key)
        if stored is None:
            raise RuntimeError(f"Durable narration segment {storage_key} is missing")
        pcm_bytes = await self.storage.get_bytes(storage_key)
        checksum = hashlib.sha256(pcm_bytes).hexdigest()
        if checksum != stored.checksum:
            raise RuntimeError("Stored narration segment checksum mismatch")
        try:
            sample_rate_hz = int(stored.metadata["sample-rate-hz"])
            channels = int(stored.metadata["channels"])
        except (KeyError, ValueError) as exception:
            raise RuntimeError("Stored narration segment audio metadata is incomplete") from exception
        return SynthesizedSegment(segment, pcm_bytes, sample_rate_hz, channels)

    async def _heartbeat_loop(self, stage_attempt_id: int) -> None:
        interval = max(3.0, self.settings.lease_seconds / 3)
        while True:
            await asyncio.sleep(interval)
            if not await self.repository.heartbeat(stage_attempt_id, self.worker_id):
                raise RuntimeError("Worker lost its narration StageAttempt lease")


class NarrationOutcomeUnknownError(RuntimeError):
    pass
