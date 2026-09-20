from __future__ import annotations

import asyncio
import time
from typing import Any

from narrativex_gpu_worker.adapters.executors.comfyui.client import (
    ComfyUIClient,
    ComfyUIClientError,
)
from narrativex_gpu_worker.application.errors import (
    ExecutionCanceledError,
    MissingDurableContextError,
)
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import (
    ExecutionContext,
    ExecutionOutput,
)
from narrativex_gpu_worker.application.ports.residency import (
    RuntimeFamily,
    RuntimeRequirement,
)
from narrativex_gpu_worker.contracts import (
    ComputeTask,
    ExecutionMetrics,
    ModelRef,
    ProducedArtifact,
    VideoGenerateInputs,
)

from .workflow import build_ltx_video_workflow


class LtxVideoExecutor:
    """Executor adapter for LTX-2.5 moving video generation."""

    name = "ltx"
    task_types = frozenset({"video.generate"})
    models = (
        ModelRef(executor="ltx", model="ltx-2.5-nvfp4", revision="1.0"),
        ModelRef(executor="ltx", model="ltx-2.5", revision="1.0"),
    )

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

    @property
    def runtime_requirement(self) -> RuntimeRequirement:
        return RuntimeRequirement(
            family=RuntimeFamily.LTX_VIDEO, vram_budget_mb=16384
        )

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput:
        if cancel.is_set():
            raise ExecutionCanceledError("LTX execution canceled before submit")

        start_time = time.perf_counter()
        inputs = task.inputs
        assert isinstance(inputs, VideoGenerateInputs)

        prompt_id: str | None = None
        if (
            context
            and context.existing_execution_handle
            and context.existing_execution_handle.startswith("ltx:")
        ):
            prompt_id = context.existing_execution_handle.split(":", 1)[1]

        if prompt_id is None:
            if (
                context is None
                or context.save_submitting is None
                or context.save_handle is None
            ):
                raise MissingDurableContextError(
                    "Durable context with save_submitting and save_handle is required "
                    "for remote side-effect executor"
                )
            await context.save_submitting()
            workflow = build_ltx_video_workflow(
                prompt=inputs.prompt,
                negative_prompt=inputs.negative_prompt,
                checkpoint=f"{task.model.model}.safetensors",
                width=inputs.width,
                height=inputs.height,
                fps=inputs.fps,
                duration_ms=inputs.duration_ms,
                seed=inputs.seed,
                generation_mode=inputs.generation_mode,
                motion_bucket_id=inputs.motion_bucket_id,
            )
            client_id = f"narrativex-video-{str(task.task_id)[:8]}"
            prompt_id = await self._client.submit_prompt(
                workflow=workflow,
                client_id=client_id,
            )
            await context.save_handle(f"ltx:{prompt_id}")
        else:
            client_id = f"narrativex-video-{str(task.task_id)[:8]}"

        record = await self._client.wait_for_completion(prompt_id, client_id, cancel)
        if cancel.is_set():
            raise ExecutionCanceledError("LTX execution canceled before artifact upload")
        video_bytes = await self._download_record_video(record)
        if cancel.is_set():
            raise ExecutionCanceledError("LTX execution canceled before artifact upload")

        runtime_ms = int((time.perf_counter() - start_time) * 1000)
        outputs: list[ProducedArtifact] = []

        if task.artifacts.outputs:
            target = task.artifacts.outputs[0]
            produced = await self._artifact_adapter.upload(target, video_bytes)
            outputs.append(produced)

        return ExecutionOutput(
            outputs=outputs,
            metrics=ExecutionMetrics(runtime_ms=runtime_ms),
            execution_handle=f"ltx:{prompt_id}",
        )

    async def _download_record_video(self, record: dict[str, Any]) -> bytes:
        outputs = record.get("outputs", {})
        for node_output in outputs.values():
            for key in ("videos", "images", "gifs"):
                files = node_output.get(key, [])
                if files:
                    first = files[0]
                    return await self._client.download_image(
                        filename=first["filename"],
                        subfolder=first.get("subfolder", ""),
                        folder_type=first.get("type", "output"),
                    )
        raise ComfyUIClientError("ComfyUI history record contained no output video or frames")


__all__ = ["LtxVideoExecutor"]
