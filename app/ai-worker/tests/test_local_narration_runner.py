import uuid
from pathlib import Path
from typing import Any, cast

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.errors import NarrationRetryableInfrastructureError
from narrativex_worker.narration.local_runner import LocalOptimizedNarrationWorkerRunner
from narrativex_worker.narration.models import NarrationSegment, SynthesizedSegment
from narrativex_worker.narration.providers import (
    TtsExecutionSemantics,
    TtsProvider,
    TtsProviderCapabilities,
    TtsRequest,
)
from narrativex_worker.narration.repository import ClaimedNarrationJob, NarrationWorkerRepository
from narrativex_worker.narration.storage import InMemoryMediaStorage, StoredMediaAsset


def claimed_job() -> ClaimedNarrationJob:
    return ClaimedNarrationJob(
        stage_attempt_id=1,
        generation_job_id=100,
        job_id="job-0",
        narration_request_id=uuid.uuid4(),
        project_id=1,
        chapter_id=1,
        chapter_row_version=1,
        source_hash="a" * 64,
        source_text="A short chapter.",
        voice_id="local-voice",
        language="vi-VN",
        speaking_rate=1.0,
        request_fingerprint="request-0",
    )


class RecordingLocalProvider:
    def __init__(self) -> None:
        self.batch_sizes: list[int] = []

    @property
    def provider_key(self) -> str:
        return "recording-local"

    @property
    def capabilities(self) -> TtsProviderCapabilities:
        return TtsProviderCapabilities(
            supports_batch=True,
            supports_speaking_rate=False,
            supports_voice_reference=True,
            execution_semantics=TtsExecutionSemantics.LOCAL_RETRYABLE,
        )

    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment:
        return (await self.synthesize_batch([request]))[0]

    async def synthesize_batch(self, requests: list[TtsRequest]) -> list[SynthesizedSegment]:
        self.batch_sizes.append(len(requests))
        return [
            SynthesizedSegment(
                segment=request.segment,
                pcm_bytes=b"\x00\x00" * 480,
                sample_rate_hz=48_000,
                channels=1,
            )
            for request in requests
        ]

    async def enroll_reference_voice(self, request_id: str, reference_audio_path: Path) -> str:
        del request_id, reference_audio_path
        return "temporary"

    async def release_reference_voice(self, voice_id: str) -> None:
        del voice_id


class RecordingAudioAssembler:
    def __init__(self) -> None:
        self.concatenate_calls = 0
        self.encode_calls = 0

    async def concatenate_files(self, input_paths: list[Path], output_path: Path) -> None:
        self.concatenate_calls += 1
        output_path.write_bytes(b"pcm")

    async def encode_mp3_file(
        self,
        pcm_path: Path,
        mp3_path: Path,
        *,
        sample_rate_hz: int,
        channels: int,
        bitrate: str,
    ) -> None:
        del pcm_path, sample_rate_hz, channels, bitrate
        self.encode_calls += 1
        mp3_path.write_bytes(b"mp3")

    async def probe_duration_ms_file(self, mp3_path: Path) -> int:
        del mp3_path
        return 10


class CompletionFailsInitiallyRepository:
    def __init__(self, failures: int) -> None:
        self.failures = failures
        self.complete_calls = 0

    async def complete(self, *args: object, **kwargs: object) -> None:
        del args, kwargs
        self.complete_calls += 1
        if self.failures:
            self.failures -= 1
            raise ConnectionError("database completion temporarily unavailable")


class FinalPersistenceFailsAfterWritingStorage(InMemoryMediaStorage):
    def __init__(self) -> None:
        super().__init__()
        self.failures = 3

    async def put_file_immutable(
        self,
        *,
        storage_key: str,
        file_path: Path,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        asset = await super().put_file_immutable(
            storage_key=storage_key,
            file_path=file_path,
            checksum=checksum,
            mime_type=mime_type,
            metadata=metadata,
        )
        if storage_key.endswith(".mp3") and self.failures:
            self.failures -= 1
            raise TimeoutError("final MP3 response was lost after the object was written")
        return asset


def test_local_runner_builds_project_scoped_audio_storage_key() -> None:
    runner = LocalOptimizedNarrationWorkerRunner(WorkerSettings(worker_env="test"))
    claimed = claimed_job()
    storage_key = runner._final_audio_storage_key(claimed)

    assert storage_key == (
        f"projects/{claimed.project_id}/assets/audio/chapter-{claimed.narration_request_id}.mp3"
    )


@pytest.mark.asyncio
async def test_local_runner_batches_and_persists_segments(tmp_path: Path) -> None:
    settings = WorkerSettings(worker_env="test", vieneu_batch_max_segments=8)
    runner = LocalOptimizedNarrationWorkerRunner(settings)
    provider = RecordingLocalProvider()
    runner.provider = cast(TtsProvider, provider)
    runner.storage = InMemoryMediaStorage()
    segments = [
        NarrationSegment(
            index=index,
            text_start=index * 5,
            text_end=(index + 1) * 5,
            text=f"seg-{index}",
        )
        for index in range(17)
    ]

    materialized = await runner._materialize_local_batches(
        claimed_job(), segments, "local-voice", tmp_path
    )

    assert provider.batch_sizes == [8, 8, 1]
    assert len(materialized) == 17
    assert [item.segment.index for item in materialized] == list(range(17))
    assert [item.frame_count for item in materialized] == [480] * 17
    assert all(item.file_path.is_file() for item in materialized)


@pytest.mark.asyncio
async def test_local_runner_reuses_vieneu_and_final_mp3_after_completion_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def no_sleep(delay: float) -> None:
        del delay

    monkeypatch.setattr("narrativex_worker.narration.errors.asyncio.sleep", no_sleep)
    runner = LocalOptimizedNarrationWorkerRunner(WorkerSettings(worker_env="test"))
    provider = RecordingLocalProvider()
    audio = RecordingAudioAssembler()
    repository = CompletionFailsInitiallyRepository(failures=3)
    runner.provider = cast(TtsProvider, provider)
    runner.storage = InMemoryMediaStorage()
    runner.audio = cast(Any, audio)
    runner.repository = cast(NarrationWorkerRepository, repository)
    claimed = claimed_job()

    with pytest.raises(NarrationRetryableInfrastructureError):
        await runner._execute_local(claimed)

    # The retry must use the same durable request identity as the failed attempt.
    await runner._execute_local(claimed)

    assert provider.batch_sizes == [1]
    assert audio.concatenate_calls == 1
    assert audio.encode_calls == 1
    assert repository.complete_calls == 4


@pytest.mark.asyncio
async def test_local_runner_does_not_regenerate_after_final_mp3_persistence_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def no_sleep(delay: float) -> None:
        del delay

    monkeypatch.setattr("narrativex_worker.narration.errors.asyncio.sleep", no_sleep)
    runner = LocalOptimizedNarrationWorkerRunner(WorkerSettings(worker_env="test"))
    provider = RecordingLocalProvider()
    audio = RecordingAudioAssembler()
    repository = CompletionFailsInitiallyRepository(failures=0)
    runner.provider = cast(TtsProvider, provider)
    runner.storage = FinalPersistenceFailsAfterWritingStorage()
    runner.audio = cast(Any, audio)
    runner.repository = cast(NarrationWorkerRepository, repository)
    claimed = claimed_job()

    with pytest.raises(NarrationRetryableInfrastructureError):
        await runner._execute_local(claimed)

    await runner._execute_local(claimed)

    assert provider.batch_sizes == [1]
    assert audio.concatenate_calls == 1
    assert audio.encode_calls == 1
