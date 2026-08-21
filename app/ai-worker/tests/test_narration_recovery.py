from dataclasses import replace
from pathlib import Path
from typing import cast
from uuid import uuid4

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.errors import narration_reconcile_delay_seconds
from narrativex_worker.narration.models import NarrationSegment, SynthesizedSegment
from narrativex_worker.narration.pricing import GoogleTtsPricingCatalog
from narrativex_worker.narration.providers import TtsRequest
from narrativex_worker.narration.repository import (
    ClaimedNarrationJob,
    DurableNarrationProviderOperation,
    NarrationWorkerRepository,
)
from narrativex_worker.narration.runner import NarrationOutcomeUnknownError, NarrationWorkerRunner
from narrativex_worker.narration.storage import InMemoryMediaStorage, StoredMediaAsset
from narrativex_worker.schema import ProviderOperationStatus


class CountingTtsProvider:
    provider_key = "fake-tts"

    def __init__(self) -> None:
        self.calls = 0

    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment:
        self.calls += 1
        return SynthesizedSegment(request.segment, b"\x00\x00" * 4800, 48000, 1)


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
