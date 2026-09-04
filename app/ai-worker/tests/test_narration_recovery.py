import hashlib
from dataclasses import replace
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.errors import (
    NarrationPermanentError,
    narration_reconcile_delay_seconds,
)
from narrativex_worker.narration.models import NarrationSegment, SynthesizedSegment
from narrativex_worker.narration.pricing import GoogleTtsPricingCatalog
from narrativex_worker.narration.providers import TtsRequest
from narrativex_worker.narration.repository import (
    ClaimedNarrationJob,
    DurableNarrationProviderOperation,
    NarrationWorkerRepository,
)
from narrativex_worker.narration.runner import (
    NarrationOutcomeUnknownError,
    NarrationWorkerRunner,
)
from narrativex_worker.narration.storage import (
    InMemoryMediaStorage,
    StoredMediaAsset,
)
from narrativex_worker.runtime.retry_policy import NARRATION_STAGE_RETRY_POLICY
from narrativex_worker.schema import ProviderOperationStatus


class CountingTtsProvider:
    provider_key = "fake-tts"

    def __init__(self) -> None:
        self.calls = 0

    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment:
        self.calls += 1
        return SynthesizedSegment(request.segment, b"\x00\x00" * 4800, 48000, 1)


class InvalidFormatTtsProvider(CountingTtsProvider):
    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment:
        self.calls += 1
        return SynthesizedSegment(request.segment, b"\x00\x00" * 4800, 44100, 1)


class PersistThenTimeoutStorage(InMemoryMediaStorage):
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
        if self.failures:
            self.failures -= 1
            raise TimeoutError("R2 response was lost after the object was written")
        return asset


class RecoveryRepository:
    def __init__(self) -> None:
        self.operation = DurableNarrationProviderOperation(
            id=7,
            stage_attempt_id=1,
            provider_key="fake-tts",
            status=ProviderOperationStatus.RESERVED,
            row_version=0,
            request_fingerprint="fingerprint",
            result=None,
            result_fingerprint=None,
        )
        self.scheduled: list[str] = []
        self.failed = False

    async def reserve_provider_operation(
        self, stage_attempt_id: int, provider_key: str, request_fingerprint: str
    ) -> DurableNarrationProviderOperation:
        del stage_attempt_id, provider_key, request_fingerprint
        return self.operation

    async def fence_submission_unknown(
        self, operation: DurableNarrationProviderOperation
    ) -> DurableNarrationProviderOperation:
        self.operation = replace(
            operation,
            status=ProviderOperationStatus.UNKNOWN,
            row_version=operation.row_version + 1,
            reconcile_attempts=0,
        )
        return self.operation

    async def schedule_provider_reconciliation(
        self, operation: DurableNarrationProviderOperation, *, error: str
    ) -> DurableNarrationProviderOperation:
        self.scheduled.append(error)
        self.operation = replace(
            operation,
            row_version=operation.row_version + 1,
            reconcile_attempts=operation.reconcile_attempts + 1,
        )
        return self.operation

    async def complete_provider_operation(
        self,
        operation: DurableNarrationProviderOperation,
        result: dict[str, object],
        *,
        character_count: int,
        pricing: object,
    ) -> DurableNarrationProviderOperation:
        del result, character_count, pricing
        self.operation = replace(
            operation,
            status=ProviderOperationStatus.COMPLETED,
            row_version=operation.row_version + 1,
        )
        return self.operation

    async def fail_provider_operation(
        self, operation: DurableNarrationProviderOperation
    ) -> DurableNarrationProviderOperation:
        self.failed = True
        self.operation = replace(
            operation,
            status=ProviderOperationStatus.FAILED,
            row_version=operation.row_version + 1,
            next_reconcile_at=None,
        )
        return self.operation


def test_narration_reconciliation_backoff_is_bounded_and_deterministic() -> None:
    assert [narration_reconcile_delay_seconds(attempt) for attempt in range(7)] == [
        5,
        10,
        20,
        40,
        80,
        160,
        300,
    ]


def test_narration_stage_retry_policy_is_bounded_and_backed_off() -> None:
    assert NARRATION_STAGE_RETRY_POLICY.max_attempts == 3
    assert [
        NARRATION_STAGE_RETRY_POLICY.delay_seconds(attempt)
        for attempt in range(NARRATION_STAGE_RETRY_POLICY.max_attempts - 1)
    ] == [5, 10]


@pytest.mark.asyncio
async def test_existing_r2_segment_recovers_without_resubmitting_tts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def no_sleep(delay: float) -> None:
        del delay

    monkeypatch.setattr("narrativex_worker.narration.errors.asyncio.sleep", no_sleep)
    runner = NarrationWorkerRunner(WorkerSettings(worker_env="test"))
    provider = CountingTtsProvider()
    storage = PersistThenTimeoutStorage()
    repository = RecoveryRepository()
    runner.provider = provider
    runner.storage = storage
    runner.pricing = GoogleTtsPricingCatalog("v1")
    runner.repository = cast(NarrationWorkerRepository, repository)

    claimed = ClaimedNarrationJob(
        stage_attempt_id=1,
        generation_job_id=1,
        job_id="job-1",
        narration_request_id=uuid4(),
        project_id=1,
        chapter_id=1,
        chapter_row_version=1,
        source_hash="a" * 64,
        source_text="hello",
        voice_id="en-US-Neural2-A",
        language="en-US",
        speaking_rate=1.0,
        request_fingerprint="request",
    )
    segment = NarrationSegment(0, 0, 5, "hello")
    pricing = runner.pricing.resolve(claimed.voice_id)

    with pytest.raises(NarrationOutcomeUnknownError):
        await runner._materialize_segment(claimed, segment, pricing, tmp_path)
    assert provider.calls == 1
    assert repository.scheduled

    recovered = await runner._materialize_segment(claimed, segment, pricing, tmp_path)

    assert provider.calls == 1
    assert recovered.file_path.is_file()
    assert repository.operation.status is ProviderOperationStatus.COMPLETED


@pytest.mark.asyncio
async def test_scratch_write_failure_is_unknown_without_resubmitting_tts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runner = NarrationWorkerRunner(WorkerSettings(worker_env="test"))
    provider = CountingTtsProvider()
    repository = RecoveryRepository()
    runner.provider = provider
    runner.storage = InMemoryMediaStorage()
    runner.pricing = GoogleTtsPricingCatalog("v1")
    runner.repository = cast(NarrationWorkerRepository, repository)
    claimed = ClaimedNarrationJob(
        stage_attempt_id=1,
        generation_job_id=1,
        job_id="job-1",
        narration_request_id=uuid4(),
        project_id=1,
        chapter_id=1,
        chapter_row_version=1,
        source_hash="a" * 64,
        source_text="hello",
        voice_id="en-US-Neural2-A",
        language="en-US",
        speaking_rate=1.0,
        request_fingerprint="request",
    )
    segment = NarrationSegment(0, 0, 5, "hello")
    pricing = runner.pricing.resolve(claimed.voice_id)
    original_open = Path.open

    def fail_segment_write(path: Path, mode: str = "r", *args: Any, **kwargs: Any) -> Any:
        if path.name == "segment-0000.pcm" and "w" in mode:
            raise OSError("scratch disk full")
        return original_open(path, mode, *args, **kwargs)

    monkeypatch.setattr(Path, "open", fail_segment_write)

    with pytest.raises(NarrationOutcomeUnknownError):
        await runner._materialize_segment(claimed, segment, pricing, tmp_path)

    assert provider.calls == 1
    assert repository.scheduled
    assert not repository.failed


@pytest.mark.asyncio
async def test_invalid_provider_audio_is_failed_after_submission_fence(
    tmp_path: Path,
) -> None:
    runner = NarrationWorkerRunner(WorkerSettings(worker_env="test"))
    provider = InvalidFormatTtsProvider()
    repository = RecoveryRepository()
    runner.provider = provider
    runner.storage = InMemoryMediaStorage()
    runner.pricing = GoogleTtsPricingCatalog("v1")
    runner.repository = cast(NarrationWorkerRepository, repository)
    claimed = ClaimedNarrationJob(
        stage_attempt_id=1,
        generation_job_id=1,
        job_id="job-1",
        narration_request_id=uuid4(),
        project_id=1,
        chapter_id=1,
        chapter_row_version=1,
        source_hash="a" * 64,
        source_text="hello",
        voice_id="en-US-Neural2-A",
        language="en-US",
        speaking_rate=1.0,
        request_fingerprint="request",
    )
    segment = NarrationSegment(0, 0, 5, "hello")
    pricing = runner.pricing.resolve(claimed.voice_id)

    with pytest.raises(NarrationPermanentError, match="48kHz mono PCM"):
        await runner._materialize_segment(claimed, segment, pricing, tmp_path)

    assert provider.calls == 1
    assert repository.failed
    assert repository.operation.status is ProviderOperationStatus.FAILED


@pytest.mark.asyncio
async def test_immutable_storage_conflict_fails_provider_operation(
    tmp_path: Path,
) -> None:
    runner = NarrationWorkerRunner(WorkerSettings(worker_env="test"))
    provider = CountingTtsProvider()
    storage = InMemoryMediaStorage()
    repository = RecoveryRepository()
    runner.provider = provider
    runner.storage = storage
    runner.pricing = GoogleTtsPricingCatalog("v1")
    runner.repository = cast(NarrationWorkerRepository, repository)
    claimed = ClaimedNarrationJob(
        stage_attempt_id=1,
        generation_job_id=1,
        job_id="job-1",
        narration_request_id=uuid4(),
        project_id=1,
        chapter_id=1,
        chapter_row_version=1,
        source_hash="a" * 64,
        source_text="hello",
        voice_id="en-US-Neural2-A",
        language="en-US",
        speaking_rate=1.0,
        request_fingerprint="request",
    )
    segment = NarrationSegment(0, 0, 5, "hello")
    pricing = runner.pricing.resolve(claimed.voice_id)
    storage_key = f"narration/{claimed.narration_request_id}/segments/0000.pcm"
    await storage.put_immutable(
        storage_key=storage_key,
        content=b"different",
        checksum="b" * 64,
        mime_type="audio/L16",
    )

    with pytest.raises(NarrationPermanentError, match="different immutable content"):
        await runner._materialize_segment(claimed, segment, pricing, tmp_path)

    assert provider.calls == 1
    assert repository.failed
    assert repository.operation.status is ProviderOperationStatus.FAILED


@pytest.mark.asyncio
async def test_corrupted_recovered_segment_fails_provider_operation(
    tmp_path: Path,
) -> None:
    runner = NarrationWorkerRunner(WorkerSettings(worker_env="test"))
    provider = CountingTtsProvider()
    storage = InMemoryMediaStorage()
    repository = RecoveryRepository()
    repository.operation = replace(
        repository.operation,
        status=ProviderOperationStatus.UNKNOWN,
        row_version=1,
    )
    runner.provider = provider
    runner.storage = storage
    runner.pricing = GoogleTtsPricingCatalog("v1")
    runner.repository = cast(NarrationWorkerRepository, repository)
    claimed = ClaimedNarrationJob(
        stage_attempt_id=1,
        generation_job_id=1,
        job_id="job-1",
        narration_request_id=uuid4(),
        project_id=1,
        chapter_id=1,
        chapter_row_version=1,
        source_hash="a" * 64,
        source_text="hello",
        voice_id="en-US-Neural2-A",
        language="en-US",
        speaking_rate=1.0,
        request_fingerprint="request",
    )
    segment = NarrationSegment(0, 0, 5, "hello")
    pricing = runner.pricing.resolve(claimed.voice_id)
    storage_key = f"narration/{claimed.narration_request_id}/segments/0000.pcm"
    content = b"\x00\x00" * 4800
    await storage.put_immutable(
        storage_key=storage_key,
        content=content,
        checksum=hashlib.sha256(content).hexdigest(),
        mime_type="audio/L16",
    )

    with pytest.raises(NarrationPermanentError, match="metadata is incomplete"):
        await runner._materialize_segment(claimed, segment, pricing, tmp_path)

    assert provider.calls == 0
    assert repository.failed
    assert repository.operation.status is ProviderOperationStatus.FAILED
