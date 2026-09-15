"""Executor adapter for Qwen LLM text generation."""

from __future__ import annotations

import asyncio
import time

from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext, ExecutionOutput
from narrativex_gpu_worker.contracts import (
    ComputeTask,
    ExecutionMetrics,
    ModelRef,
    ProducedArtifact,
    TextGenerateInputs,
)

from .client import QwenClient


class QwenExecutor:
    """Executor adapter for local Qwen text generation."""

    name = "qwen"
    task_types = frozenset({"text.generate"})
    models = (
        ModelRef(executor="qwen", model="Qwen/Qwen3-8B-AWQ", revision="default"),
        ModelRef(executor="qwen", model="Qwen/Qwen3-8B-AWQ", revision="1.0"),
        ModelRef(executor="qwen", model="qwen3-8b", revision="default"),
        ModelRef(executor="qwen", model="qwen3-8b", revision="1.0"),
        ModelRef(executor="qwen", model="qwen-local", revision="default"),
        ModelRef(executor="qwen", model="qwen-local", revision="1.0"),
    )

    def __init__(
        self,
        client: QwenClient,
        artifact_adapter: ArtifactPort,
        ready: bool = True,
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
            return ExecutionOutput()

        start_time = time.perf_counter()
        inputs = task.inputs
        assert isinstance(inputs, TextGenerateInputs)

        content, response_id = await self._client.generate(
            prompt=inputs.prompt,
            system_prompt=inputs.system_prompt,
            model=task.model.model,
            temperature=inputs.temperature,
            top_p=inputs.top_p,
            max_tokens=inputs.max_tokens,
            response_format=inputs.response_format,
            cancel=cancel,
        )

        runtime_ms = int((time.perf_counter() - start_time) * 1000)
        outputs: list[ProducedArtifact] = []

        if task.artifacts.outputs:
            content_bytes = content.encode("utf-8")
            target = task.artifacts.outputs[0]
            produced = await self._artifact_adapter.upload(target, content_bytes)
            outputs.append(produced)

        handle = f"qwen:{response_id}" if response_id else None
        if context and context.save_handle and handle:
            await context.save_handle(handle)

        return ExecutionOutput(
            outputs=outputs,
            metrics=ExecutionMetrics(runtime_ms=runtime_ms),
            execution_handle=handle,
        )


__all__ = ["QwenExecutor"]
