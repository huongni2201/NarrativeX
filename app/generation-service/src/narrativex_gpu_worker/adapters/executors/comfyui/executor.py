from __future__ import annotations

import asyncio
import time
from typing import Any

from narrativex_gpu_worker.application.errors import MissingDurableContextError
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext, ExecutionOutput
from narrativex_gpu_worker.contracts import (
    ComputeTask,
    ExecutionMetrics,
    ImageGenerateInputs,
    ModelRef,
    ProducedArtifact,
)

from .client import ComfyUIClient, ComfyUIClientError
from .workflow import build_txt2img_workflow


class ComfyUIExecutor:
    """Executor adapter for ComfyUI RealVisXL image generation."""

    name = "comfyui"
    task_types = frozenset({"image.generate"})
    models = (ModelRef(executor="comfyui", model="realvisxl", revision="5.0"),)

    def __init__(
        self,
        client: ComfyUIClient,
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
        assert isinstance(inputs, ImageGenerateInputs)

        prompt_id: str | None = None
        if (
            context
            and context.existing_execution_handle
            and context.existing_execution_handle.startswith("comfyui:")
        ):
            prompt_id = context.existing_execution_handle.split(":", 1)[1]

        if prompt_id is None:
            if context is None or context.save_submitting is None or context.save_handle is None:
                raise MissingDurableContextError(
                    "Durable context with save_submitting and save_handle is required for remote side-effect executor"
                )
            await context.save_submitting()
            workflow = build_txt2img_workflow(
                prompt=inputs.prompt,
                negative_prompt=inputs.negative_prompt,
                checkpoint=f"{task.model.model}.safetensors",
                width=inputs.width,
                height=inputs.height,
                seed=inputs.seed,
            )
            prompt_id = await self._client.submit_prompt(
                workflow=workflow,
                client_id=f"narrativex-{str(task.task_id)[:8]}",
            )
            await context.save_handle(f"comfyui:{prompt_id}")

        record = await self._client.poll_history(prompt_id, cancel)
        image_bytes = await self._download_record_image(record)

        runtime_ms = int((time.perf_counter() - start_time) * 1000)
        outputs: list[ProducedArtifact] = []

        if task.artifacts.outputs:
            target = task.artifacts.outputs[0]
            produced = await self._artifact_adapter.upload(target, image_bytes)
            outputs.append(produced)

        return ExecutionOutput(
            outputs=outputs,
            metrics=ExecutionMetrics(runtime_ms=runtime_ms),
            execution_handle=f"comfyui:{prompt_id}",
        )

    async def _download_record_image(self, record: dict[str, Any]) -> bytes:
        outputs = record.get("outputs", {})
        for node_output in outputs.values():
            images = node_output.get("images", [])
            if images:
                first = images[0]
                return await self._client.download_image(
                    filename=first["filename"],
                    subfolder=first.get("subfolder", ""),
                    folder_type=first.get("type", "output"),
                )
        raise ComfyUIClientError("ComfyUI history record contained no output images")


__all__ = ["ComfyUIExecutor"]
