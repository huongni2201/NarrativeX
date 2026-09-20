from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from narrativex_gpu_worker.adapters.executors.comfyui.client import ComfyUIClient
from narrativex_gpu_worker.adapters.executors.ltx.executor import LtxVideoExecutor
from narrativex_gpu_worker.adapters.executors.ltx.workflow import build_ltx_video_workflow
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext
from narrativex_gpu_worker.contracts import (
    ArtifactWriteAccess,
    ComputeTask,
    ModelRef,
    OutputArtifactTarget,
    ProducedArtifact,
    TaskArtifacts,
    TaskConstraints,
    TaskDescriptor,
    VideoGenerateInputs,
)


@pytest.fixture
def video_task() -> ComputeTask:
    task_id = UUID("0199b861-cc3c-7a8e-a915-e5dbff3af7aa")
    attempt_id = UUID("0199b862-1025-78be-bd71-c6969b74ab71")
    return ComputeTask(
        protocol_version="1.0",
        task_id=task_id,
        attempt_id=attempt_id,
        idempotency_key="compute:video:1",
        request_fingerprint="0" * 64,
        task=TaskDescriptor(type="video.generate", schema_version="1.0"),
        model=ModelRef(executor="ltx", model="ltx-2.5-nvfp4", revision="1.0"),
        constraints=TaskConstraints(
            deadline=datetime.now(UTC) + timedelta(minutes=10),
            max_runtime_seconds=600,
        ),
        inputs=VideoGenerateInputs(
            prompt="A cinematic shot of a warrior running through misty forest",
            negative_prompt="blurry, morphing",
            width=1280,
            height=720,
            fps=24,
            duration_ms=4000,
            generation_mode="TEXT_TO_VIDEO",
            seed=42,
        ),
        artifacts=TaskArtifacts(
            outputs=[
                OutputArtifactTarget(
                    artifact_id=UUID("0199b86a-6db8-75b8-bd98-78442a0177de"),
                    role="target-video",
                    media_type="video/mp4",
                    access=ArtifactWriteAccess(
                        method="PUT",
                        url="https://artifacts.local/upload",
                        expires_at=datetime.now(UTC) + timedelta(minutes=10),
                    ),
                )
            ]
        ),
    )


def test_ltx_executor_metadata() -> None:
    client = AsyncMock(spec=ComfyUIClient)
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    executor = LtxVideoExecutor(client, artifact_adapter)

    assert executor.name == "ltx"
    assert "video.generate" in executor.task_types
    assert any(m.model == "ltx-2.5-nvfp4" for m in executor.models)
    assert executor.runtime_requirement.vram_budget_mb >= 16384


def test_build_ltx_video_workflow() -> None:
    wf = build_ltx_video_workflow(
        prompt="A hero leaping across rooftops",
        negative_prompt="blurry",
        checkpoint="ltx-2.5-nvfp4.safetensors",
        width=1280,
        height=720,
        fps=24,
        duration_ms=3000,
        seed=123,
    )

    assert "4" in wf
    assert wf["4"]["class_type"] == "EmptyLatentVideo"
    # 3 seconds * 24 fps = 72 frames
    assert wf["4"]["inputs"]["length"] == 72
    assert wf["4"]["inputs"]["width"] == 1280
    assert wf["4"]["inputs"]["height"] == 720
    assert wf["7"]["class_type"] == "SaveVideo"
    assert wf["7"]["inputs"]["fps"] == 24


@pytest.mark.asyncio
async def test_ltx_execute_success(video_task: ComputeTask) -> None:
    client = AsyncMock(spec=ComfyUIClient)
    client.submit_prompt.return_value = "prompt-ltx-123"
    client.wait_for_completion.return_value = {
        "outputs": {
            "7": {
                "videos": [
                    {"filename": "NarrativeX_Shot_00001.mp4", "subfolder": "", "type": "output"}
                ]
            }
        }
    }
    client.download_image.return_value = b"fake-mp4-video-stream-content"

    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.upload.return_value = ProducedArtifact(
        artifact_id=video_task.artifacts.outputs[0].artifact_id,
        role="target-video",
        media_type="video/mp4",
        size_bytes=len(b"fake-mp4-video-stream-content"),
        sha256="a" * 64,
    )

    executor = LtxVideoExecutor(client, artifact_adapter)
    cancel = asyncio.Event()

    context = ExecutionContext(
        save_submitting=AsyncMock(),
        save_handle=AsyncMock(),
    )

    output = await executor.execute(video_task, cancel, context)

    assert output.execution_handle == "ltx:prompt-ltx-123"
    assert len(output.outputs) == 1
    assert output.outputs[0].role == "target-video"
    artifact_adapter.upload.assert_awaited_once()
