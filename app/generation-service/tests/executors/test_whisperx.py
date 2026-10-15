from __future__ import annotations

import asyncio
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest

from narrativex_gpu_worker.adapters.executors.catalog import ExecutorCatalog
from narrativex_gpu_worker.adapters.executors.whisperx.client import (
    WhisperXClient,
    WhisperXClientError,
)
from narrativex_gpu_worker.adapters.executors.whisperx.executor import WhisperXExecutor
from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)
from narrativex_gpu_worker.adapters.runtime.manager import GpuResidencyManager
from narrativex_gpu_worker.application.errors import CapacityError
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.residency import RuntimeFamily, RuntimeRequirement
from narrativex_gpu_worker.application.services.execution import ExecutionApplicationService
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
    request_fingerprint,
)


async def test_alignment_deadline_holds_residency_and_capacity_until_thread_finishes(
    tmp_path: Path,
) -> None:
    started = threading.Event()
    released = threading.Event()
    next_family_loaded = asyncio.Event()

    class BlockingModule(FakeWhisperXModule):
        def align(self, *args, **kwargs):
            started.set()
            assert released.wait(5)
            return {"word_segments": self.words}

    client = WhisperXClient(device="cpu", whisperx_module=BlockingModule())
    executor = WhisperXExecutor(client, InMemoryArtifactAdapter(), ready=True)
    residency = GpuResidencyManager(
        unload_hooks={RuntimeFamily.WHISPERX: executor.unload},
    )
    journal = SqliteExecutionJournalAdapter(tmp_path / "deadline.sqlite3")
    now = datetime.now(UTC)
    service = ExecutionApplicationService(
        journal, ExecutorCatalog((executor,)), 1, residency=residency, now_fn=lambda: now
    )
    task = _build_task()
    task.constraints.deadline = now + timedelta(seconds=0.3)
    task.request_fingerprint = request_fingerprint(task)

    async def switch_family():
        async with residency.acquire(RuntimeRequirement(family=RuntimeFamily.LTX_VIDEO)):
            next_family_loaded.set()

    await service.start()
    pending_switch = None
    try:
        await service.submit(task)
        async with asyncio.timeout(2):
            while not started.is_set():
                await asyncio.sleep(0.01)
        pending_switch = asyncio.create_task(switch_family())
        await asyncio.sleep(0.4)
        assert residency.active_leases == 1
        assert not next_family_loaded.is_set()
        with pytest.raises(CapacityError):
            new_task = _build_task()
            new_task.request_fingerprint = request_fingerprint(new_task)
            await service.submit(new_task)
        assert client._models, "The still-running model must remain owned"
        released.set()
        await asyncio.wait_for(pending_switch, 2)
        assert not client._models
        assert residency.active_leases == 0
    finally:
        released.set()
        await service.stop()
        if pending_switch is not None:
            await asyncio.gather(pending_switch, return_exceptions=True)
        await residency.release_all()


async def test_same_family_reuses_model_and_family_switch_unloads_it() -> None:
    module = FakeWhisperXModule()
    client = WhisperXClient(device="cpu", whisperx_module=module)
    executor = WhisperXExecutor(client, InMemoryArtifactAdapter(), ready=True)
    catalog = ExecutorCatalog((executor,))

    async def unload():
        await catalog.unload_runtime(RuntimeFamily.WHISPERX)

    residency = GpuResidencyManager(unload_hooks={RuntimeFamily.WHISPERX: unload})
    for _ in range(2):
        async with residency.acquire(executor.runtime_requirement):
            await client.align(b"wav", "xin chào thế giới")
    assert module.load_model_calls == 1
    async with residency.acquire(RuntimeRequirement(family=RuntimeFamily.LTX_VIDEO)):
        assert not client._models
    async with residency.acquire(executor.runtime_requirement):
        await client.align(b"wav", "xin chào thế giới")
    assert module.load_model_calls == 2
    await residency.release_all()


async def test_cancel_waits_for_real_inference_and_unload_clears_cached_model() -> None:
    started = threading.Event()
    released = threading.Event()

    class BlockingModule(FakeWhisperXModule):
        def align(self, *args, **kwargs):
            started.set()
            assert released.wait(3)
            return {"word_segments": self.words}

    module = BlockingModule()
    client = WhisperXClient(device="cpu", whisperx_module=module)
    inference = asyncio.create_task(client.align(b"wav", "xin chào thế giới"))
    try:
        async with asyncio.timeout(2):
            while not started.is_set():
                await asyncio.sleep(0.01)
        inference.cancel()
        await asyncio.sleep(0.05)
        assert not inference.done(), "Inference ownership must outlive awaiter cancellation"
    finally:
        released.set()
        await asyncio.gather(inference, return_exceptions=True)
    await client.unload()
    await client.align(b"wav", "xin chào thế giới")
    assert module.load_model_calls == 2


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
    module = FakeWhisperXModule([{"word": "khác", "start": 0.1, "end": 0.4, "score": 0.9}])
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
