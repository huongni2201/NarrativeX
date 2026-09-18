from __future__ import annotations

import asyncio
import io
import wave
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock
from uuid import UUID

import httpx
import pytest
from pydantic import HttpUrl

from narrativex_gpu_worker.adapters.executors.vieneu.client import VieNeuClient
from narrativex_gpu_worker.adapters.executors.vieneu.executor import (
    VieNeuExecutor,
    normalize_to_wav_48k_mono,
)
from narrativex_gpu_worker.application.errors import (
    AmbiguousOutcomeError,
    ExecutionCanceledError,
)
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext
from narrativex_gpu_worker.application.ports.residency import RuntimeFamily
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


def make_valid_wav_48k() -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(48000)
        wf.writeframes(b"\x00\x00" * 480)
    return buf.getvalue()


@pytest.fixture
def speech_task() -> ComputeTask:
    task_id = UUID("0199b861-cc3c-7a8e-a915-e5dbff3af7aa")
    attempt_id = UUID("0199b862-1025-78be-bd71-c6969b74ab71")
    task = ComputeTask(
        protocol_version="1.0",
        task_id=task_id,
        attempt_id=attempt_id,
        idempotency_key="compute:vieneu:1",
        request_fingerprint="0" * 64,
        task=TaskDescriptor(type="audio.synthesize", schema_version="1.0"),
        model=ModelRef(executor="vieneu", model="vieneu-v3-turbo", revision="default"),
        constraints=TaskConstraints(
            deadline=datetime.now(UTC) + timedelta(minutes=10),
            max_runtime_seconds=300,
        ),
        inputs=AudioSynthesizeInputs(
            script="Xin chào thế giới từ VieNeu.",
            voice=VoiceSelection(kind="catalog", value="vieneu-default"),
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
                        url=HttpUrl("https://example.com/staging/out.wav"),
                        expires_at=datetime.now(UTC) + timedelta(hours=1),
                    ),
                )
            ],
        ),
    )
    task.request_fingerprint = request_fingerprint(task)
    return task


def create_mock_vieneu_client(
    wav_bytes: bytes | None = None,
) -> tuple[httpx.AsyncClient, list[dict[str, Any]]]:
    requests_log: list[dict[str, Any]] = []
    content = wav_bytes or make_valid_wav_48k()

    async def handler(request: httpx.Request) -> httpx.Response:
        requests_log.append({"method": request.method, "url": str(request.url)})
        if request.url.path == "/healthz":
            return httpx.Response(200, json={"status": "OK"})
        if request.url.path == "/v1/voices":
            return httpx.Response(200, json=[{"id": "vieneu-default", "name": "VieNeu Default"}])
        return httpx.Response(200, content=content)

    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://127.0.0.1:8008")
    return client, requests_log


def test_vieneu_executor_properties() -> None:
    http_client, _ = create_mock_vieneu_client()
    executor = VieNeuExecutor(
        client=VieNeuClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
        ready=True,
    )
    assert executor.name == "vieneu"
    assert executor.task_types == frozenset({"audio.synthesize"})
    assert any(m.model == "vieneu-v3-turbo" for m in executor.models)
    assert executor.runtime_requirement.family == RuntimeFamily.VIENEU
    assert executor.runtime_requirement.exclusive is False
    assert executor.ready is True


def test_vieneu_executor_defaults_to_not_ready() -> None:
    http_client, _ = create_mock_vieneu_client()
    executor = VieNeuExecutor(
        client=VieNeuClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
    )
    assert executor.ready is False


async def test_vieneu_executor_rejects_resuming_from_handle(speech_task: ComputeTask) -> None:
    http_client, requests_log = create_mock_vieneu_client()
    executor = VieNeuExecutor(
        client=VieNeuClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
        ready=True,
    )
    cancel = asyncio.Event()
    context = ExecutionContext(existing_execution_handle="vieneu:existing-handle-123")

    with pytest.raises(AmbiguousOutcomeError, match="VieNeu does not support resuming"):
        await executor.execute(speech_task, cancel, context=context)
    assert len(requests_log) == 0


async def test_vieneu_executor_cancels_before_submit(speech_task: ComputeTask) -> None:
    http_client, requests_log = create_mock_vieneu_client()
    executor = VieNeuExecutor(
        client=VieNeuClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
        ready=True,
    )
    cancel = asyncio.Event()
    cancel.set()

    with pytest.raises(ExecutionCanceledError, match="canceled before submit"):
        await executor.execute(speech_task, cancel)
    assert len(requests_log) == 0


async def test_vieneu_executor_synthesizes_and_uploads(speech_task: ComputeTask) -> None:
    valid_wav = make_valid_wav_48k()
    http_client, requests_log = create_mock_vieneu_client(valid_wav)
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.upload.return_value = ProducedArtifact(
        artifact_id=speech_task.artifacts.outputs[0].artifact_id,
        role="audio",
        media_type="audio/wav",
        size_bytes=len(valid_wav),
        sha256="c" * 64,
    )

    executor = VieNeuExecutor(
        client=VieNeuClient(client=http_client),
        artifact_adapter=artifact_adapter,
        ready=True,
    )
    cancel = asyncio.Event()
    submitting_mock = AsyncMock()
    context = ExecutionContext(save_submitting=submitting_mock)

    output = await executor.execute(speech_task, cancel, context=context)

    submitting_mock.assert_awaited_once()
    assert len(requests_log) == 1
    assert requests_log[0]["url"] == "http://127.0.0.1:8008/v1/audio/speech"
    assert len(output.outputs) == 1
    assert output.outputs[0].artifact_id == speech_task.artifacts.outputs[0].artifact_id
    assert output.execution_handle is None
    assert output.metrics.runtime_ms is not None


async def test_vieneu_executor_reference_voice_clone(speech_task: ComputeTask) -> None:
    valid_wav = make_valid_wav_48k()
    http_client, requests_log = create_mock_vieneu_client(valid_wav)
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.download.return_value = b"ref-audio-bytes"
    artifact_adapter.upload.return_value = ProducedArtifact(
        artifact_id=speech_task.artifacts.outputs[0].artifact_id,
        role="audio",
        media_type="audio/wav",
        size_bytes=len(valid_wav),
        sha256="d" * 64,
    )

    # Set voice to artifact
    speech_task.inputs = AudioSynthesizeInputs(
        script="Giọng nói sao chép.",
        voice=VoiceSelection(kind="artifact", value="sample-voice-ref"),
        format=AudioFormat(container="wav", sample_rate_hz=48000, channels=1),
    )
    speech_task.artifacts.inputs.append(
        InputArtifactRef(
            artifact_id=UUID("0199b86a-6db8-75b8-bd98-78442a0177df"),
            role="sample-voice-ref",
            media_type="audio/wav",
            size_bytes=100,
            sha256="e" * 64,
            access=ArtifactReadAccess(
                method="GET",
                url=HttpUrl("https://example.com/ref.wav"),
                expires_at=datetime.now(UTC) + timedelta(hours=1),
            ),
        )
    )

    executor = VieNeuExecutor(
        client=VieNeuClient(client=http_client),
        artifact_adapter=artifact_adapter,
        ready=True,
    )
    cancel = asyncio.Event()
    output = await executor.execute(speech_task, cancel)

    artifact_adapter.download.assert_awaited_once()
    assert len(requests_log) == 1
    assert requests_log[0]["url"] == "http://127.0.0.1:8008/generate"
    assert len(output.outputs) == 1


async def test_vieneu_client_health_and_voices() -> None:
    http_client, _ = create_mock_vieneu_client()
    client = VieNeuClient(client=http_client)
    assert await client.health() is True
    voices = await client.voices()
    assert len(voices) == 1
    assert voices[0]["id"] == "vieneu-default"


def test_normalize_to_wav_48k_mono() -> None:
    valid_wav = make_valid_wav_48k()
    # Already 48k mono 16-bit
    result = normalize_to_wav_48k_mono(valid_wav)
    assert result == valid_wav

    # Empty or corrupt bytes returns unchanged without error
    assert normalize_to_wav_48k_mono(b"") == b""
    assert normalize_to_wav_48k_mono(b"short") == b"short"
