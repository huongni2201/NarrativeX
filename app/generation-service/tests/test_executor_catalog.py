import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.application.errors import ExecutorNotSupportedError
from narrativex_gpu_worker.application.ports.execution import (
    ExecutionContext,
    ExecutionOutput,
    ExecutorPort,
)
from narrativex_gpu_worker.contracts import (
    AudioFormat,
    AudioSynthesizeInputs,
    ComputeTask,
    ImageGenerateInputs,
    ModelRef,
    TaskArtifacts,
    TaskConstraints,
    TaskDescriptor,
    VoiceSelection,
)


class DummyExecutor(ExecutorPort):
    def __init__(
        self,
        name: str = "voicestudio",
        task_types: frozenset[str] = frozenset({"audio.synthesize"}),
        models: tuple[ModelRef, ...] = (
            ModelRef(executor="voicestudio", model="vi-profile", revision="0.5.2"),
        ),
        ready: bool = True,
    ) -> None:
        self._name = name
        self._task_types = task_types
        self._models = models
        self._ready = ready

    @property
    def name(self) -> str:
        return self._name

    @property
    def task_types(self) -> frozenset[str]:
        return self._task_types

    @property
    def models(self) -> tuple[ModelRef, ...]:
        return self._models

    @property
    def ready(self) -> bool:
        return self._ready

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput:
        return ExecutionOutput()


def _make_task(
    executor_name: str = "voicestudio",
    model_name: str = "vi-profile",
    revision: str = "0.5.2",
    task_type: str = "audio.synthesize",
) -> ComputeTask:
    task_id = uuid4()
    inputs: AudioSynthesizeInputs | ImageGenerateInputs
    if task_type == "image.generate":
        inputs = ImageGenerateInputs(
            prompt="test prompt",
            negative_prompt="",
            width=512,
            height=512,
            seed=42,
        )
    else:
        inputs = AudioSynthesizeInputs(
            script="test",
            voice=VoiceSelection(kind="catalog", value="vi_female_01"),
            format=AudioFormat(container="wav", sample_rate_hz=48000, channels=1),
        )
    return ComputeTask(
        protocol_version="1.0",
        task_id=task_id,
        attempt_id=uuid4(),
        idempotency_key=f"compute:{task_id}:1",
        request_fingerprint="0" * 64,
        task=TaskDescriptor(type=task_type, schema_version="1.0"),
        model=ModelRef(executor=executor_name, model=model_name, revision=revision),
        constraints=TaskConstraints(
            deadline=datetime.now(UTC) + timedelta(minutes=10),
            max_runtime_seconds=600,
        ),
        inputs=inputs,
        artifacts=TaskArtifacts(inputs=[], outputs=[]),
    )


def test_catalog_rejects_duplicate_executor_names() -> None:
    e1 = DummyExecutor(name="same")
    e2 = DummyExecutor(name="same")
    with pytest.raises(ValueError, match="must be unique"):
        ExecutorCatalog((e1, e2))


def test_catalog_resolves_ready_executor() -> None:
    executor = DummyExecutor()
    catalog = ExecutorCatalog((executor,))
    resolved = catalog.resolve(_make_task())
    assert resolved is executor


def test_catalog_rejects_unavailable_executor() -> None:
    executor = DummyExecutor(ready=False)
    catalog = ExecutorCatalog((executor,))
    with pytest.raises(ExecutorNotSupportedError, match="unavailable"):
        catalog.resolve(_make_task())


def test_catalog_rejects_unsupported_executor_name() -> None:
    executor = DummyExecutor(name="voicestudio")
    catalog = ExecutorCatalog((executor,))
    with pytest.raises(ExecutorNotSupportedError, match="unavailable"):
        catalog.resolve(_make_task(executor_name="nonexistent"))


def test_catalog_rejects_unsupported_task_type() -> None:
    executor = DummyExecutor()
    catalog = ExecutorCatalog((executor,))
    with pytest.raises(ExecutorNotSupportedError, match="unsupported"):
        catalog.resolve(_make_task(task_type="image.generate"))


def test_catalog_rejects_unsupported_model_revision() -> None:
    executor = DummyExecutor()
    catalog = ExecutorCatalog((executor,))
    with pytest.raises(ExecutorNotSupportedError, match="unsupported"):
        catalog.resolve(_make_task(revision="9.9.9"))


def test_catalog_capabilities_reports_accurate_state() -> None:
    e1 = DummyExecutor(name="voicestudio", ready=True)
    e2 = DummyExecutor(
        name="whisperx",
        task_types=frozenset({"audio.align"}),
        models=(ModelRef(executor="whisperx", model="large-v3", revision="3.8.6"),),
        ready=False,
    )
    catalog = ExecutorCatalog((e1, e2))
    caps = {c.name: c for c in catalog.capabilities()}

    assert len(caps) == 2
    assert caps["voicestudio"].ready is True
    assert caps["voicestudio"].task_types == ["audio.synthesize"]
    assert caps["whisperx"].ready is False
    assert caps["whisperx"].task_types == ["audio.align"]
