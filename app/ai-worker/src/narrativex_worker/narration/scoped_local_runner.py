"""Narration runner that composes scoped custom voices with catalog-owned system voices."""

import asyncio
from pathlib import Path

from narrativex_worker.narration.errors import (
    NarrationPermanentError,
    NarrationRetryableInfrastructureError,
    is_transient_infrastructure_error,
    retry_local_io,
)
from narrativex_worker.narration.local_runner import LocalOptimizedNarrationWorkerRunner
from narrativex_worker.narration.repository import ClaimedNarrationJob
from narrativex_worker.narration.storage import S3MediaStorage
from narrativex_worker.narration.voice_reference import (
    VoiceReferenceAudioError,
    prepare_voice_reference,
)


class ScopedLocalNarrationWorkerRunner(LocalOptimizedNarrationWorkerRunner):
    """Keep PROJECT/ACCOUNT custom voice semantics and add SYSTEM R2 fallback."""

    async def _prepare_reference(self, claimed: ClaimedNarrationJob, job_dir: Path) -> Path | None:
        if claimed.voice_reference_scope is not None:
            return await super()._prepare_reference(claimed, job_dir)
        if claimed.voice_reference_storage_key is None:
            return None
        return await self._download_system_reference(claimed, job_dir)

    async def _download_system_reference(
        self, claimed: ClaimedNarrationJob, job_dir: Path
    ) -> Path:
        storage_key = claimed.voice_reference_storage_key
        if not storage_key:
            raise NarrationPermanentError("System voice reference is missing R2 storage metadata")

        source_path = job_dir / "system-voice-reference-source"
        reference_audio_path = job_dir / "voice-reference.wav"
        voice_reference_storage = S3MediaStorage(self.settings)
        self.logger.info(
            "Downloading system voice reference from R2 job=%s request=%s voiceId=%s storageKey=%s",
            claimed.job_id,
            claimed.narration_request_id,
            claimed.voice_id,
            storage_key,
        )
        try:
            await retry_local_io(
                lambda: voice_reference_storage.download_to_file(storage_key, source_path)
            )
        except Exception as exception:
            self.logger.exception(
                "System voice reference R2 download failed job=%s request=%s storageKey=%s",
                claimed.job_id,
                claimed.narration_request_id,
                storage_key,
            )
            if is_transient_infrastructure_error(exception):
                raise NarrationRetryableInfrastructureError(
                    "System voice reference storage is temporarily unavailable"
                ) from exception
            raise NarrationPermanentError(
                "System voice reference audio could not be downloaded"
            ) from exception

        try:
            await asyncio.to_thread(
                prepare_voice_reference,
                source_path,
                reference_audio_path,
                content_type=None,
            )
        except VoiceReferenceAudioError as exception:
            raise NarrationPermanentError(str(exception)) from exception
        return reference_audio_path
