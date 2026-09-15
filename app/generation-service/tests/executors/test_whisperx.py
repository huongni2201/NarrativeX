from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest

from narrativex_gpu_worker.adapters.executors.whisperx.client import (
    WhisperXClient,
    WhisperXClientError,
)
from narrativex_gpu_worker.adapters.executors.whisperx.executor import WhisperXExecutor
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.contracts import (
    ArtifactReadAccess,
    ArtifactWriteAccess,
    AudioAlignInputs,
    ComputeTask,
    InputArtifactRef,
    ModelRef,
    OutputArtifactTarget,
    ProducedArtifact,
    TaskArtifacts,
    TaskConstraints,
    TaskDescriptor,
)


class InMemoryArtifactAdapter(ArtifactPort):
    def __init__(self) -> None:
        self.downloaded: list[InputArtifactRef] = []
        self.uploaded: list[tuple[OutputArtifactTarget, bytes]] = []

    async def download(self, artifact: InputArtifactRef) -> bytes:
        self.downloaded.append(artifact)
        return b"RIFFfakeWAVaudio"

    async def upload(self, target: OutputArtifactTarget, content: bytes) -> ProducedArtifact:
        self.uploaded.append((target, content))
        return ProducedArtifact(
            artifact_id=target.artifact_id,
            role=target.role,
            media_type=target.media_type,
            size_bytes=len(content),
            sha256="0" * 64,
        )


def _build_task() -> ComputeTask:
    task_id = uuid4()
    attempt_id = uuid4()
    return ComputeTask(
        protocol_version="1.0",
        task_id=task_id,
        attempt_id=attempt_id,
        idempotency_key=f"compute:{task_id}:1",
        request_fingerprint="0" * 64,
        task=TaskDescriptor(type="audio.align", schema_version="1.0"),
        model=ModelRef(executor="whisperx", model="large-v3", revision="3.8.6"),
        constraints=TaskConstraints(
            deadline=datetime.now(UTC) + timedelta(minutes=10),
            max_runtime_seconds=600,
        ),
        inputs=AudioAlignInputs(
            script="xin chào thế giới",
            audio_artifact_role="source-audio",
            language="vi",
        ),
        artifacts=TaskArtifacts(
            inputs=[
                InputArtifactRef(
                    artifact_id=uuid4(),
                    role="source-audio",
                    media_type="audio/wav",
                    size_bytes=16,
                    sha256="0" * 64,
                    access=ArtifactReadAccess(
                        method="GET",
                        url="https://example.com/input.wav",
                        expires_at=datetime.now(UTC),
                    ),
                )
            ],
            outputs=[
                OutputArtifactTarget(
                    artifact_id=uuid4(),
                    role="alignment",
                    media_type="application/json",
                    access=ArtifactWriteAccess(
                        method="PUT",
                        url="https://example.com/output.json",
                        expires_at=datetime.now(UTC),
                    ),
                )
            ],
        ),
    )


async def test_whisperx_client_raises_unavailable_error() -> None:
    client = WhisperXClient()
    with pytest.raises(WhisperXClientError, match="not configured or unavailable"):
        await client.align(b"audio", "xin chao")


async def test_whisperx_executor_defaults_to_not_ready() -> None:
    executor = WhisperXExecutor(WhisperXClient(), InMemoryArtifactAdapter())
    assert executor.ready is False


async def test_whisperx_executor_fails_and_does_not_upload_when_unavailable() -> None:
    artifact_adapter = InMemoryArtifactAdapter()
    executor = WhisperXExecutor(WhisperXClient(), artifact_adapter, ready=False)
    task = _build_task()

    with pytest.raises(WhisperXClientError):
        await executor.execute(task, asyncio.Event())

    assert len(artifact_adapter.downloaded) == 1
    assert len(artifact_adapter.uploaded) == 0


class FakeWorkingWhisperXClient(WhisperXClient):
    async def align(
        self,
        audio_bytes: bytes,
        script: str,
        language: str = "vi",
        model: str = "large-v3",
    ) -> list[dict[str, Any]]:
        return [{"word": "test", "start": 0.0, "end": 0.4, "score": 0.99}]


async def test_whisperx_executor_succeeds_with_injected_test_client() -> None:
    artifact_adapter = InMemoryArtifactAdapter()
    executor = WhisperXExecutor(FakeWorkingWhisperXClient(), artifact_adapter, ready=True)
    task = _build_task()

    output = await executor.execute(task, asyncio.Event())

    assert len(output.outputs) == 1
    assert output.outputs[0].role == "alignment"
    assert len(artifact_adapter.uploaded) == 1
