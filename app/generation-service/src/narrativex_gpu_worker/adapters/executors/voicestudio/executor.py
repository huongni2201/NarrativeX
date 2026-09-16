from __future__ import annotations

import asyncio
import time

from narrativex_gpu_worker.application.errors import (
    AmbiguousOutcomeError,
    ExecutionCanceledError,
)
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext, ExecutionOutput
from narrativex_gpu_worker.contracts import (
    AudioSynthesizeInputs,
    ComputeTask,
    ExecutionMetrics,
    ModelRef,
    ProducedArtifact,
)

from .client import VoiceStudioClient


class VoiceStudioExecutor:
    """Executor adapter for VoiceStudio Vietnamese audio synthesis."""

    name = "voicestudio"
    task_types = frozenset({"audio.synthesize"})
    models = (ModelRef(executor="voicestudio", model="vi-profile", revision="0.5.2"),)

    def __init__(
        self,
        client: VoiceStudioClient,
        artifact_adapter: ArtifactPort,
        ready: bool = False,
    ) -> None:
        self._client = client
        self._artifact_adapter = artifact_adapter
        self._ready = ready

    @property
    def ready(self) -> bool:
        return self._ready

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput:
        if cancel.is_set():
            raise ExecutionCanceledError("VoiceStudio execution canceled before submit")

        if (
            context
            and context.existing_execution_handle
        ):
            raise AmbiguousOutcomeError(
                "VoiceStudio does not support resuming from execution handle without "
                "lookup/dedup capability"
            )

        if context and context.save_submitting:
            await context.save_submitting()

        start_time = time.perf_counter()
        inputs = task.inputs
        assert isinstance(inputs, AudioSynthesizeInputs)

        if inputs.voice.kind == "artifact":
            ref_artifact = next(
                (a for a in task.artifacts.inputs if a.role == inputs.voice.value),
                None,
            )
            if ref_artifact is None:
                raise ValueError(f"Reference audio artifact not found: {inputs.voice.value}")
            ref_bytes = await self._artifact_adapter.download(ref_artifact)
            if cancel.is_set():
                raise ExecutionCanceledError("VoiceStudio execution canceled before synthesis")
            wav_bytes = await self._client.synthesize_reference(
                text=inputs.script,
                reference_wav=ref_bytes,
                model=task.model.model,
                cancel=cancel,
            )
        else:
            wav_bytes = await self._client.synthesize(
                text=inputs.script,
                voice=inputs.voice.value,
                model=task.model.model,
                cancel=cancel,
            )

        if cancel.is_set():
            raise ExecutionCanceledError("VoiceStudio execution canceled before artifact upload")

        runtime_ms = int((time.perf_counter() - start_time) * 1000)
        outputs: list[ProducedArtifact] = []

        if task.artifacts.outputs:
            if cancel.is_set():
                raise ExecutionCanceledError(
                    "VoiceStudio execution canceled before artifact upload"
                )
            target = task.artifacts.outputs[0]
            produced = await self._artifact_adapter.upload(target, wav_bytes)
            outputs.append(produced)

        return ExecutionOutput(
            outputs=outputs,
            metrics=ExecutionMetrics(runtime_ms=runtime_ms),
            execution_handle=None,
        )


__all__ = ["VoiceStudioExecutor"]
