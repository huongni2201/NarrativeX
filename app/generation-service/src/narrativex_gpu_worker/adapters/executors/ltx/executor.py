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
    ExecutorExecutionError,
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
        ModelRef(executor="ltx", model="ltx-2.5", revision="nvfp4"),
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

        if not any(m.model == task.model.model for m in self.models):
            raise ExecutorExecutionError(
                code="VIDEO_MODEL_UNAVAILABLE",
                message=(
                    f"Model {task.model.model} revision {task.model.revision} "
                    "is not supported by LTX executor"
                ),
                category="PERMANENT",
            )

        start_time = time.perf_counter()
        inputs = task.inputs
        assert isinstance(inputs, VideoGenerateInputs)

        # Resolve input reference artifacts if provided
        for input_ref in task.artifacts.inputs:
            if cancel.is_set():
                raise ExecutionCanceledError("LTX execution canceled during reference resolution")
            try:
                ref_bytes = await self._artifact_adapter.download(input_ref)
                if not ref_bytes:
                    raise ValueError(
                        f"Downloaded reference artifact {input_ref.artifact_id} is empty"
                    )
            except Exception as exc:
                raise ExecutorExecutionError(
                    code="VIDEO_REFERENCE_INVALID",
                    message=(
                        f"Failed to resolve input reference artifact {input_ref.artifact_id}: {exc}"
                    ),
                    category="PERMANENT",
                ) from exc

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
                dialogue=inputs.dialogue,
                camera_intent=inputs.camera_intent,
                motion_intent=inputs.motion_intent,
                voice_reference=inputs.voice_reference,
                provider_options=inputs.provider_options,
            )
            client_id = f"narrativex-video-{str(task.task_id)[:8]}"
            try:
                prompt_id = await self._client.submit_prompt(
                    workflow=workflow,
                    client_id=client_id,
                )
                await context.save_handle(f"ltx:{prompt_id}")
            except ComfyUIClientError as exc:
                raise ExecutorExecutionError(
                    code="VIDEO_GENERATION_FAILED",
                    message=f"ComfyUI prompt submission failed: {exc}",
                    category="TRANSIENT",
                ) from exc
        else:
            client_id = f"narrativex-video-{str(task.task_id)[:8]}"

        try:
            record = await self._client.wait_for_completion(prompt_id, client_id, cancel)
        except ExecutionCanceledError:
            raise
        except ComfyUIClientError as exc:
            raise ExecutorExecutionError(
                code="VIDEO_GENERATION_FAILED",
                message=f"ComfyUI video generation execution failed: {exc}",
                category="TRANSIENT",
            ) from exc

        if cancel.is_set():
            raise ExecutionCanceledError("LTX execution canceled before artifact upload")

        try:
            video_bytes = await self._download_record_video(record)
        except ComfyUIClientError as exc:
            raise ExecutorExecutionError(
                code="VIDEO_GENERATION_FAILED",
                message=f"Failed to retrieve video artifact from ComfyUI: {exc}",
                category="TRANSIENT",
            ) from exc

        if not video_bytes or len(video_bytes) < 32:
            raise ExecutorExecutionError(
                code="VIDEO_GENERATION_FAILED",
                message="ComfyUI returned empty or invalid video output",
                category="TRANSIENT",
            )

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
