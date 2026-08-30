"""Optimized local narration execution with local project output and scoped voice references."""

import asyncio
from pathlib import Path

from narrativex_worker.narration.alignment import build_alignment, normalize_alignment_duration
from narrativex_worker.narration.errors import (
    NarrationLeaseLostError,
    NarrationPermanentError,
    NarrationRetryableInfrastructureError,
    is_transient_infrastructure_error,
    retry_local_io,
)
from narrativex_worker.narration.models import MaterializedAudioSegment, NarrationSegment
from narrativex_worker.narration.providers import (
    TtsExecutionSemantics,
    TtsProviderRejectedError,
    TtsRequest,
)
from narrativex_worker.narration.repository import ClaimedNarrationJob
from narrativex_worker.narration.runner import NarrationWorkerRunner
from narrativex_worker.narration.segmenter import utf16_length
from narrativex_worker.narration.storage import MediaAssetConflictError, S3MediaStorage
from narrativex_worker.narration.voice_reference import (
    VoiceReferenceAudioError,
    prepare_voice_reference,
)
from narrativex_worker.narration.voice_reference_resolver import (
    ProjectVoiceReferenceError,
    resolve_project_voice_reference,
)
from narrativex_worker.workspace import sha256_file


class LocalOptimizedNarrationWorkerRunner(NarrationWorkerRunner):
    """Batch local TTS, persist project audio locally, and resolve scoped custom voices."""

    async def _execute(self, claimed: ClaimedNarrationJob) -> None:
        assert self.provider is not None
        if self.provider.capabilities.execution_semantics is TtsExecutionSemantics.EXTERNAL_DURABLE:
            await super()._execute(claimed)
            return
        await self._execute_local(claimed)

    async def _execute_local(self, claimed: ClaimedNarrationJob) -> None:
        assert self.provider is not None
        project_media_storage = self.storage
        assert project_media_storage is not None
        self.logger.info(
            "Starting local narration job=%s request=%s voiceId=%s sourceChars=%s "
            "voiceReferenceScope=%s",
            claimed.job_id,
            claimed.narration_request_id,
            claimed.voice_id,
            len(claimed.source_text),
            claimed.voice_reference_scope,
        )
        async with self.workspace.create_job_dir(str(claimed.narration_request_id)) as job_dir:
            reference_audio_path = await self._prepare_reference(claimed, job_dir)
            voice_id = claimed.voice_id
            temporary_voice: str | None = None
            if reference_audio_path is not None:
                try:
                    temporary_voice = await self.provider.enroll_reference_voice(
                        str(claimed.narration_request_id), reference_audio_path
                    )
                    voice_id = temporary_voice
                    self.logger.info(
                        "Local narration voice reference enrolled job=%s request=%s voiceId=%s",
                        claimed.job_id,
                        claimed.narration_request_id,
                        voice_id,
                    )
                except TtsProviderRejectedError as exception:
                    raise NarrationPermanentError(str(exception)) from exception
                except Exception as exception:
                    self.logger.exception(
                        "Local narration voice enrollment failed job=%s request=%s",
                        claimed.job_id,
                        claimed.narration_request_id,
                    )
                    raise NarrationRetryableInfrastructureError(
                        "Local voice enrollment failed"
                    ) from exception

            try:
                segments = self.segmenter.segment(claimed.source_text)
                self.logger.info(
                    "Local narration segmented job=%s request=%s segmentCount=%s batchSize=%s",
                    claimed.job_id,
                    claimed.narration_request_id,
                    len(segments),
                    self.settings.vieneu_batch_max_segments,
                )
                materialized = await self._materialize_local_batches(
                    claimed, segments, voice_id, job_dir
                )
            finally:
                if temporary_voice is not None:
                    await self.provider.release_reference_voice(temporary_voice)

            pcm_path = job_dir / "chapter.pcm"
            await self.audio.concatenate_files([item.file_path for item in materialized], pcm_path)
            mp3_path = job_dir / "chapter.mp3"
            await self.audio.encode_mp3_file(
                pcm_path,
                mp3_path,
                sample_rate_hz=48000,
                channels=1,
                bitrate=self.settings.narration_mp3_bitrate,
            )
            actual_duration_ms = await self.audio.probe_duration_ms_file(mp3_path)
            spans = normalize_alignment_duration(
                build_alignment(materialized), audio_duration_ms=actual_duration_ms
            )
            self.validator.validate(
                spans,
                source_utf16_length=utf16_length(claimed.source_text),
                audio_duration_ms=actual_duration_ms,
            )
            checksum = await asyncio.to_thread(sha256_file, mp3_path)
            final_key = self._final_audio_storage_key(claimed, checksum)
            try:
                media_asset = await retry_local_io(
                    lambda: project_media_storage.put_file_immutable(
                        storage_key=final_key,
                        file_path=mp3_path,
                        checksum=checksum,
                        mime_type="audio/mpeg",
                        metadata={
                            "duration-ms": str(actual_duration_ms),
                            "execution-semantics": "local-retryable",
                        },
                    )
                )
            except MediaAssetConflictError as exception:
                raise NarrationPermanentError(str(exception)) from exception
            except Exception as exception:
                if is_transient_infrastructure_error(exception):
                    raise NarrationRetryableInfrastructureError(
                        "Final narration local storage is temporarily unavailable"
                    ) from exception
                raise NarrationPermanentError(str(exception)) from exception

            self.logger.info(
                "Narration local media persisted job=%s request=%s storageKey=%s "
                "sizeBytes=%s checksum=%s",
                claimed.job_id,
                claimed.narration_request_id,
                media_asset.storage_key,
                media_asset.size_bytes,
                media_asset.checksum,
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
                "Completed local narration job=%s request=%s durationMs=%s "
                "finalSizeBytes=%s batches=%s storageKey=%s",
                claimed.job_id,
                claimed.narration_request_id,
                actual_duration_ms,
                mp3_path.stat().st_size,
                (len(segments) + self.settings.vieneu_batch_max_segments - 1)
                // self.settings.vieneu_batch_max_segments,
                media_asset.storage_key,
            )

    @staticmethod
    def _final_audio_storage_key(claimed: ClaimedNarrationJob, checksum: str) -> str:
        return (
            f"projects/{claimed.project_id}/assets/audio/"
            f"chapter-{checksum[:16]}.mp3"
        )

    async def _prepare_reference(self, claimed: ClaimedNarrationJob, job_dir: Path) -> Path | None:
        if claimed.voice_reference_scope is None:
            return None
        self._validate_claimed_voice_reference(claimed)
        reference_audio_path = job_dir / "voice-reference.wav"

        if claimed.voice_reference_scope == "PROJECT":
            assert claimed.voice_reference_asset_id is not None
            assert claimed.voice_reference_size_bytes is not None
            assert claimed.voice_reference_checksum is not None
            try:
                source_path = await asyncio.to_thread(
                    resolve_project_voice_reference,
                    projects_root=Path(self.settings.project_media_local_dir),
                    project_id=claimed.project_id,
                    asset_id=claimed.voice_reference_asset_id,
                    expected_size_bytes=claimed.voice_reference_size_bytes,
                    expected_sha256=claimed.voice_reference_checksum,
                )
            except (OSError, ProjectVoiceReferenceError) as exception:
                raise NarrationPermanentError(str(exception)) from exception
        elif claimed.voice_reference_scope == "ACCOUNT":
            source_path = await self._download_account_reference(claimed, job_dir)
        else:
            raise NarrationPermanentError("Unknown voice reference scope")

        try:
            await asyncio.to_thread(
                prepare_voice_reference,
                source_path,
                reference_audio_path,
                content_type=claimed.voice_reference_content_type,
            )
        except VoiceReferenceAudioError as exception:
            raise NarrationPermanentError(str(exception)) from exception
        return reference_audio_path

    async def _download_account_reference(
        self, claimed: ClaimedNarrationJob, job_dir: Path
    ) -> Path:
        if not claimed.voice_reference_storage_key:
            raise NarrationPermanentError("Account voice reference is missing R2 storage metadata")
        source_path = job_dir / "voice-reference-source"
        voice_reference_storage = S3MediaStorage(self.settings)
        self.logger.info(
            "Downloading account voice reference from R2 job=%s request=%s storageKey=%s",
            claimed.job_id,
            claimed.narration_request_id,
            claimed.voice_reference_storage_key,
        )
        try:
            await retry_local_io(
                lambda: voice_reference_storage.download_to_file(
                    claimed.voice_reference_storage_key or "", source_path
                )
            )
        except Exception as exception:
            self.logger.exception(
                "Voice reference R2 download failed job=%s request=%s storageKey=%s",
                claimed.job_id,
                claimed.narration_request_id,
                claimed.voice_reference_storage_key,
            )
            if is_transient_infrastructure_error(exception):
                raise NarrationRetryableInfrastructureError(
                    "Voice reference storage is temporarily unavailable"
                ) from exception
            raise NarrationPermanentError(
                "Voice reference audio could not be downloaded"
            ) from exception

        assert claimed.voice_reference_size_bytes is not None
        assert claimed.voice_reference_checksum is not None
        if source_path.stat().st_size != claimed.voice_reference_size_bytes:
            raise NarrationPermanentError("Account voice reference size does not match metadata")
        checksum = await asyncio.to_thread(sha256_file, source_path)
        if checksum != claimed.voice_reference_checksum.lower():
            raise NarrationPermanentError(
                "Account voice reference checksum does not match metadata"
            )
        return source_path

    @staticmethod
    def _validate_claimed_voice_reference(claimed: ClaimedNarrationJob) -> None:
        if claimed.voice_reference_asset_id is None:
            raise NarrationPermanentError("Voice reference asset id is missing")
        if claimed.voice_reference_status != "READY":
            raise NarrationPermanentError("Voice reference asset is not READY")
        if claimed.voice_reference_size_bytes is None or claimed.voice_reference_size_bytes <= 0:
            raise NarrationPermanentError("Voice reference size metadata is invalid")
        checksum = claimed.voice_reference_checksum or ""
        if len(checksum) != 64 or any(ch not in "0123456789abcdefABCDEF" for ch in checksum):
            raise NarrationPermanentError("Voice reference checksum metadata is invalid")
        if claimed.voice_reference_scope == "PROJECT" and claimed.voice_reference_storage_key:
            raise NarrationPermanentError("Project voice reference must not contain R2 metadata")

    async def _materialize_local_batches(
        self,
        claimed: ClaimedNarrationJob,
        segments: list[NarrationSegment],
        voice_id: str,
        job_dir: Path,
    ) -> list[MaterializedAudioSegment]:
        assert self.provider is not None
        materialized: list[MaterializedAudioSegment] = []
        batch_size = self.settings.vieneu_batch_max_segments
        for offset in range(0, len(segments), batch_size):
            batch = segments[offset : offset + batch_size]
            batch_number = offset // batch_size + 1
            total_batches = (len(segments) + batch_size - 1) // batch_size
            self.logger.info(
                "Starting VieNeu batch job=%s request=%s batch=%s/%s segmentStart=%s "
                "segmentCount=%s",
                claimed.job_id,
                claimed.narration_request_id,
                batch_number,
                total_batches,
                offset,
                len(batch),
            )
            requests = [
                TtsRequest(
                    request_id=f"{claimed.narration_request_id}:segment:{segment.index:04d}",
                    segment=segment,
                    voice_id=voice_id,
                    language=claimed.language,
                    speaking_rate=claimed.speaking_rate,
                )
                for segment in batch
            ]
            try:
                synthesized_batch = await self.provider.synthesize_batch(requests)
            except TtsProviderRejectedError as exception:
                raise NarrationPermanentError(str(exception)) from exception
            except (OSError, TimeoutError, RuntimeError) as exception:
                raise NarrationRetryableInfrastructureError(
                    "Local VieNeu synthesis failed and can be retried safely"
                ) from exception
            if len(synthesized_batch) != len(batch):
                raise NarrationRetryableInfrastructureError(
                    "Local TTS returned an incomplete synthesis batch"
                )
            for expected, synthesized in zip(batch, synthesized_batch, strict=True):
                if synthesized.segment.index != expected.index:
                    raise NarrationPermanentError("Local TTS returned segments out of order")
                try:
                    self._validate_audio_format(synthesized)
                except (TypeError, ValueError) as exception:
                    raise NarrationPermanentError(str(exception)) from exception
                segment_path = job_dir / f"segment-{expected.index:04d}.pcm"
                try:
                    segment_path.write_bytes(synthesized.pcm_bytes)
                    checksum = await asyncio.to_thread(sha256_file, segment_path)
                except OSError as exception:
                    raise NarrationRetryableInfrastructureError(
                        "Local narration workspace is temporarily unavailable"
                    ) from exception
                materialized.append(
                    MaterializedAudioSegment(
                        segment=expected,
                        file_path=segment_path,
                        sample_rate_hz=synthesized.sample_rate_hz,
                        channels=synthesized.channels,
                        duration_ms=synthesized.duration_ms,
                        checksum=checksum,
                        frame_count=synthesized.frame_count,
                    )
                )
            self.logger.info(
                "Completed VieNeu batch job=%s request=%s batch=%s/%s materialized=%s",
                claimed.job_id,
                claimed.narration_request_id,
                batch_number,
                total_batches,
                len(materialized),
            )
        return materialized
