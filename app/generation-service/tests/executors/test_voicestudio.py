from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock
from uuid import UUID

import httpx
import pytest

from narrativex_gpu_worker.adapters.executors.voicestudio.client import (
    VoiceStudioClient,
    VoiceStudioClientError,
)
from narrativex_gpu_worker.adapters.executors.voicestudio.executor import (
    VoiceStudioExecutor,
)
from narrativex_gpu_worker.application.errors import AmbiguousOutcomeError
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext
from narrativex_gpu_worker.contracts import (
    ArtifactReadAccess,
    ArtifactWriteAccess,
    AudioFormat,
    AudioSynthesizeInputs,
    ComputeTask,
    InputArtifactRef,
    ModelRef,
    OutputArtifactTarget,
    ProducedArtifact,
    TaskArtifacts,
    TaskConstraints,
    TaskDescriptor,
    VoiceSelection,
)
from narrativex_gpu_worker.contracts.fingerprint import request_fingerprint


@pytest.fixture
def speech_task() -> ComputeTask:
    task_id = UUID("0199b861-cc3c-7a8e-a915-e5dbff3af7aa")
    attempt_id = UUID("0199b862-1025-78be-bd71-c6969b74ab71")
    task = ComputeTask(
        protocol_version="1.0",
        task_id=task_id,
        attempt_id=attempt_id,
        idempotency_key="compute:voice:1",
        request_fingerprint="0" * 64,
        task=TaskDescriptor(type="audio.synthesize", schema_version="1.0"),
        model=ModelRef(executor="voicestudio", model="vi-profile", revision="0.5.2"),
        constraints=TaskConstraints(
            deadline=datetime.now(UTC) + timedelta(minutes=10),
            max_runtime_seconds=300,
        ),
        inputs=AudioSynthesizeInputs(
            script="Xin chào thế giới.",
            voice=VoiceSelection(kind="catalog", value="vi_female_01"),
            format=AudioFormat(container="wav", sample_rate_hz=48000, channels=1),
        ),
        artifacts=TaskArtifacts(
            inputs=[],
            outputs=[
                OutputArtifactTarget(
                    artifact_id=UUID("0199b86a-6db8-75b8-bd98-78442a0177de"),
                    role="audio",
                    media_type="audio/wav",
                    access=ArtifactWriteAccess(
                        method="PUT",
                        url="https://example.com/staging/out.wav",
                        expires_at=datetime.now(UTC) + timedelta(hours=1),
                    ),
                )
            ],
        ),
    )
    task.request_fingerprint = request_fingerprint(task)
    return task


def create_mock_voice_client() -> tuple[httpx.AsyncClient, list[dict[str, Any]]]:
    requests_log: list[dict[str, Any]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests_log.append({"method": request.method, "url": str(request.url)})
        return httpx.Response(200, content=b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00data\x00\x00\x00\x00")

    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://127.0.0.1:8000")
    return client, requests_log


def test_voicestudio_executor_defaults_to_not_ready() -> None:
    http_client, _ = create_mock_voice_client()
    executor = VoiceStudioExecutor(
        client=VoiceStudioClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
    )
    assert executor.ready is False


async def test_voicestudio_executor_rejects_resuming_from_handle(speech_task: ComputeTask) -> None:
    http_client, requests_log = create_mock_voice_client()
    executor = VoiceStudioExecutor(
        client=VoiceStudioClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
        ready=True,
    )
    cancel = asyncio.Event()

    context = ExecutionContext(
        existing_execution_handle="voicestudio:existing-handle-123",
    )

    with pytest.raises(AmbiguousOutcomeError, match="VoiceStudio does not support resuming"):
        await executor.execute(speech_task, cancel, context=context)
    assert len(requests_log) == 0


async def test_voicestudio_executor_calls_save_submitting_and_synthesizes(
    speech_task: ComputeTask,
) -> None:
    http_client, requests_log = create_mock_voice_client()
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.upload.return_value = ProducedArtifact(
        artifact_id=speech_task.artifacts.outputs[0].artifact_id,
        role="audio",
        media_type="audio/wav",
        size_bytes=36,
        sha256="b" * 64,
    )

    executor = VoiceStudioExecutor(
        client=VoiceStudioClient(client=http_client),
        artifact_adapter=artifact_adapter,
        ready=True,
    )
    cancel = asyncio.Event()

    submitting_mock = AsyncMock()
    context = ExecutionContext(save_submitting=submitting_mock)

    output = await executor.execute(speech_task, cancel, context=context)

    assert submitting_mock.await_count == 1
    assert len(output.outputs) == 1
    assert artifact_adapter.upload.await_count == 1
    assert len(requests_log) == 1
    assert requests_log[0]["url"] == "http://127.0.0.1:8000/v1/audio/speech"


async def test_voicestudio_client_redacts_error_payload() -> None:
    async def error_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            500,
            text="Failure with secret key and prompt 'SECRET_STORY_SCRIPT'",
        )

    transport = httpx.MockTransport(error_handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://127.0.0.1:8000")
    voice_client = VoiceStudioClient(client=client)

    with pytest.raises(VoiceStudioClientError) as exc_info:
        await voice_client.synthesize(text="SECRET_STORY_SCRIPT", voice="vi_female_01")

    assert "SECRET_STORY_SCRIPT" not in str(exc_info.value)
    assert "status 500" in str(exc_info.value)


async def test_voicestudio_reference_audio_missing_raises(speech_task: ComputeTask) -> None:
    speech_task.inputs.voice = VoiceSelection(kind="artifact", value="missing-role")
    http_client, requests_log = create_mock_voice_client()
    executor = VoiceStudioExecutor(
        client=VoiceStudioClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
        ready=True,
    )
    cancel = asyncio.Event()

    with pytest.raises(ValueError, match="Reference audio artifact not found"):
        await executor.execute(speech_task, cancel)
    assert len(requests_log) == 0


async def test_voicestudio_cancellation_returns_early(speech_task: ComputeTask) -> None:
    http_client, requests_log = create_mock_voice_client()
    executor = VoiceStudioExecutor(
        client=VoiceStudioClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
        ready=True,
    )
    cancel = asyncio.Event()
    cancel.set()

    output = await executor.execute(speech_task, cancel)
    assert len(output.outputs) == 0
    assert len(requests_log) == 0
