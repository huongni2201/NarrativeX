from __future__ import annotations

import asyncio
import json
import time

from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext, ExecutionOutput
from narrativex_gpu_worker.contracts import (
    ComputeTask,
    ExecutionMetrics,
    MediaValidateInputs,
    ModelRef,
    ProducedArtifact,
)


class MediaValidationExecutor:
    """Executor adapter for media validation and integrity verification."""

    name = "media-validator"
    task_types = frozenset({"media.validate"})
    models = (ModelRef(executor="media-validator", model="builtin", revision="1"),)

    def __init__(self, artifact_adapter: ArtifactPort, ready: bool = True) -> None:
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
        assert isinstance(inputs, MediaValidateInputs)

        input_artifact = next(
            (a for a in task.artifacts.inputs if a.role == inputs.artifact_role),
            None,
        )
        if input_artifact is None:
            raise ValueError(f"Input media artifact not found: {inputs.artifact_role}")

        if input_artifact.media_type not in inputs.allowed_media_types:
            allowed = inputs.allowed_media_types
            raise ValueError(
                f"Media type {input_artifact.media_type} is not in allowed types: {allowed}"
            )

        content = await self._artifact_adapter.download(input_artifact)
        if inputs.decode:
            self._verify_media_content(content, input_artifact.media_type)

        validation_result = {
            "valid": True,
            "mediaType": input_artifact.media_type,
            "sizeBytes": len(content),
        }
        result_bytes = json.dumps(validation_result).encode("utf-8")
        runtime_ms = int((time.perf_counter() - start_time) * 1000)
        outputs: list[ProducedArtifact] = []

        if task.artifacts.outputs:
            target = task.artifacts.outputs[0]
            produced = await self._artifact_adapter.upload(target, result_bytes)
            outputs.append(produced)

        return ExecutionOutput(
            outputs=outputs,
            metrics=ExecutionMetrics(runtime_ms=runtime_ms),
            execution_handle=f"validator:{task.task_id}",
        )

    @staticmethod
    def _verify_media_content(content: bytes, media_type: str) -> None:
        if media_type == "image/png":
            if len(content) < 8 or content[:8] != b"\x89PNG\r\n\x1a\n":
                raise ValueError("Content is not a valid PNG image")
        elif media_type in ("image/jpeg", "image/jpg"):
            if len(content) < 3 or content[:3] != b"\xff\xd8\xff":
                raise ValueError("Content is not a valid JPEG image")
        elif media_type == "audio/wav":
            if len(content) < 12 or content[:4] != b"RIFF" or content[8:12] != b"WAVE":
                raise ValueError("Content is not a valid WAV audio")


__all__ = ["MediaValidationExecutor"]
