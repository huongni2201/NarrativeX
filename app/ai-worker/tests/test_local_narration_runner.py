from pathlib import Path
from typing import cast

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.local_runner import LocalOptimizedNarrationWorkerRunner
from narrativex_worker.narration.models import NarrationSegment, SynthesizedSegment
from narrativex_worker.narration.providers import (
    TtsExecutionSemantics,
    TtsProvider,
    TtsProviderCapabilities,
    TtsRequest,
)
from narrativex_worker.narration.repository import ClaimedNarrationJob
from tests.test_narration_runner import claimed_job


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


@pytest.mark.asyncio
async def test_local_runner_batches_segments_without_remote_materialization(tmp_path: Path) -> None:
    settings = WorkerSettings(
        worker_env="test",
        vieneu_batch_max_segments=8,
    )
    runner = LocalOptimizedNarrationWorkerRunner(settings)
    provider = RecordingLocalProvider()
    runner.provider = cast(TtsProvider, provider)
    claimed: ClaimedNarrationJob = claimed_job(0)
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
        claimed, segments, "local-voice", tmp_path
    )

    assert provider.batch_sizes == [8, 8, 1]
    assert len(materialized) == 17
    assert [item.segment.index for item in materialized] == list(range(17))
    assert all(item.file_path.is_file() for item in materialized)
