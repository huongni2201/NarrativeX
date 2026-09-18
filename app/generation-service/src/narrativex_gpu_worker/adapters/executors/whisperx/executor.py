from __future__ import annotations

import asyncio
import json
import time

from narrativex_gpu_worker.application.errors import ExecutionCanceledError
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext, ExecutionOutput
from narrativex_gpu_worker.application.ports.residency import RuntimeFamily, RuntimeRequirement
from narrativex_gpu_worker.contracts import (
    AudioAlignInputs,
    ComputeTask,
    ExecutionMetrics,
    ModelRef,
    ProducedArtifact,
)

from .client import WhisperXClient


class WhisperXExecutor:
    """Executor adapter for WhisperX audio alignment."""

    name = "whisperx"
    task_types = frozenset({"audio.align"})
    models = (ModelRef(executor="whisperx", model="large-v3", revision="3.8.6"),)

    def __init__(
        self,
        client: WhisperXClient,
        artifact_adapter: ArtifactPort,
        ready: bool = False,
    ) -> None:
        self._client = client
        self._artifact_adapter = artifact_adapter
        self._ready = ready

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def runtime_requirement(self) -> RuntimeRequirement:
        return RuntimeRequirement(family=RuntimeFamily.WHISPERX, vram_budget_mb=3072)

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput:
        if cancel.is_set():
            raise ExecutionCanceledError("WhisperX execution canceled before download")

        start_time = time.perf_counter()
        inputs = task.inputs
        assert isinstance(inputs, AudioAlignInputs)

        input_artifact = next(
            (a for a in task.artifacts.inputs if a.role == inputs.audio_artifact_role),
            None,
        )
        if input_artifact is None:
            raise ValueError(f"Input audio artifact not found: {inputs.audio_artifact_role}")

        audio_bytes = await self._artifact_adapter.download(input_artifact)
        if cancel.is_set():
            raise ExecutionCanceledError("WhisperX execution canceled before alignment")
        alignment_data = await self._client.align(
            audio_bytes=audio_bytes,
            script=inputs.script,
            language=inputs.language,
            model=task.model.model,
        )

        alignment_json = json.dumps(alignment_data, ensure_ascii=False).encode("utf-8")
        runtime_ms = int((time.perf_counter() - start_time) * 1000)
        outputs: list[ProducedArtifact] = []

        if task.artifacts.outputs:
            if cancel.is_set():
                raise ExecutionCanceledError("WhisperX execution canceled before artifact upload")
            target = task.artifacts.outputs[0]
            produced = await self._artifact_adapter.upload(target, alignment_json)
            outputs.append(produced)

        return ExecutionOutput(
            outputs=outputs,
            metrics=ExecutionMetrics(runtime_ms=runtime_ms),
            execution_handle=f"whisperx:{task.task_id}",
        )


__all__ = ["WhisperXExecutor"]
