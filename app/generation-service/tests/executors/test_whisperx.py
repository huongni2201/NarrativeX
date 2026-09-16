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


class FakeWhisperXModule:
    def __init__(self, words: list[dict[str, Any]] | None = None) -> None:
        self.words = words or [
            {"word": "xin", "start": 0.10, "end": 0.30, "score": 0.99},
            {"word": "chào", "start": 0.35, "end": 0.60, "score": 0.98},
            {"word": "thế", "start": 0.65, "end": 0.80, "score": 0.97},
            {"word": "giới", "start": 0.82, "end": 1.10, "score": 0.96},
        ]
        self.load_model_calls = 0

    def load_audio(self, _path: str) -> list[float]:
        return [0.0] * 32_000

    def load_align_model(
        self, *, language_code: str, device: str, model_name: str | None = None
    ) -> tuple[object, dict[str, str]]:
        assert language_code == "vi"
        assert device == "cpu"
        assert model_name is None
        self.load_model_calls += 1
        return object(), {"language": language_code}

    def align(self, *_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {"word_segments": self.words}


async def test_whisperx_client_returns_canonical_measured_word_clock() -> None:
    module = FakeWhisperXModule()
    client = WhisperXClient(device="cpu", whisperx_module=module)

    words = await client.align(b"RIFFfakeWAVaudio", "xin chào thế giới", "vi")

    assert words == [
        {
            "index": 0,
            "textStart": 0,
            "textEnd": 3,
            "audioStartMs": 100,
            "audioEndMs": 300,
            "confidence": 0.99,
        },
        {
            "index": 1,
            "textStart": 4,
            "textEnd": 8,
            "audioStartMs": 350,
            "audioEndMs": 600,
            "confidence": 0.98,
        },
        {
            "index": 2,
            "textStart": 9,
            "textEnd": 12,
            "audioStartMs": 650,
            "audioEndMs": 800,
            "confidence": 0.97,
        },
        {
            "index": 3,
            "textStart": 13,
            "textEnd": 17,
            "audioStartMs": 820,
            "audioEndMs": 1100,
            "confidence": 0.96,
        },
    ]
    assert module.load_model_calls == 1


async def test_whisperx_client_rejects_token_divergence_instead_of_inventing_timing() -> None:
    module = FakeWhisperXModule(
        [{"word": "khác", "start": 0.1, "end": 0.4, "score": 0.9}]
    )
    client = WhisperXClient(device="cpu", whisperx_module=module)

    with pytest.raises(WhisperXClientError, match="token counts diverged"):
        await client.align(b"RIFFfakeWAVaudio", "xin chào", "vi")


async def test_whisperx_executor_defaults_to_not_ready() -> None:
    executor = WhisperXExecutor(
        WhisperXClient(device="cpu", whisperx_module=FakeWhisperXModule()),
        InMemoryArtifactAdapter(),
    )
    assert executor.ready is False


class FakeWorkingWhisperXClient(WhisperXClient):
    async def align(
        self,
        audio_bytes: bytes,
        script: str,
        language: str = "vi",
        model: str = "large-v3",
    ) -> list[dict[str, Any]]:
        return [
            {
                "index": 0,
                "textStart": 0,
                "textEnd": 3,
                "audioStartMs": 0,
                "audioEndMs": 400,
                "confidence": 0.99,
            }
        ]


async def test_whisperx_executor_succeeds_with_injected_test_client() -> None:
    artifact_adapter = InMemoryArtifactAdapter()
    executor = WhisperXExecutor(FakeWorkingWhisperXClient(), artifact_adapter, ready=True)
    task = _build_task()

    output = await executor.execute(task, asyncio.Event())

    assert len(output.outputs) == 1
    assert output.outputs[0].role == "alignment"
    assert len(artifact_adapter.uploaded) == 1
