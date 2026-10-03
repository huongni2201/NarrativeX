from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from narrativex_gpu_worker.adapters.executors.comfyui.client import (
    ComfyUIClient,
    ComfyUIClientError,
)
from narrativex_gpu_worker.adapters.executors.ltx.executor import LtxVideoExecutor
from narrativex_gpu_worker.adapters.executors.ltx.workflow import (
    build_ltx_video_workflow,
    compose_ltx_positive_prompt,
)
from narrativex_gpu_worker.application.errors import (
    ExecutorExecutionError,
)
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext
from narrativex_gpu_worker.contracts import (
    ArtifactReadAccess,
    ArtifactWriteAccess,
    ComputeTask,
    InputArtifactRef,
    ModelRef,
    OutputArtifactTarget,
    ProducedArtifact,
    TaskArtifacts,
    TaskConstraints,
    TaskDescriptor,
    VideoCameraIntent,
    VideoDialogueLine,
    VideoGenerateInputs,
    VideoMotionIntent,
    VideoVoiceReference,
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
        model=ModelRef(
            executor="ltx",
            model="ltx-2.5-22b-distilled-int8",
            revision="5e6e71018ee1756ed329b697a7b4aedc934dfce9",
        ),
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
            dialogue=[VideoDialogueLine(speaker="Warrior", text="We must keep moving!")],
            camera_intent=VideoCameraIntent(
                framing="medium-close", movement="tracking", angle="low-angle"
            ),
            motion_intent=VideoMotionIntent(
                subject_motion="sprinting forward", speed="fast", dynamics="high"
            ),
            voice_reference=VideoVoiceReference(
                voice_description="deep heroic grit", delivery_baseline="urgent"
            ),
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
    assert any(m.model == "ltx-2.5-22b-distilled-int8" for m in executor.models)
    assert executor.runtime_requirement.vram_budget_mb >= 16384
    assert not executor.ready


def test_compose_ltx_positive_prompt() -> None:
    composed = compose_ltx_positive_prompt(
        base_prompt="A knight stands in the rain",
        dialogue=[VideoDialogueLine(speaker="Knight", text="Hold the line!")],
        camera_intent=VideoCameraIntent(
            framing="close-up", movement="slow-zoom", angle="eye-level"
        ),
        motion_intent=VideoMotionIntent(subject_motion="standing firm", speed="still"),
        voice_reference=VideoVoiceReference(voice_description="resonant commanding baritone"),
    )
    assert "A knight stands in the rain" in composed
    assert (
        "[Cinematography: framing: close-up, camera movement: slow-zoom, camera angle: eye-level]"
        in composed
    )
    assert "[Motion: action: standing firm, motion speed: still]" in composed
    assert '[Dialogue: Knight: "Hold the line!"]' in composed
    assert "[Voice Identity: tone: resonant commanding baritone]" in composed


def test_build_ltx_video_workflow() -> None:
    wf = build_ltx_video_workflow(
        prompt="A hero leaping across rooftops",
        negative_prompt="blurry",
        checkpoint="ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
        width=1280,
        height=720,
        fps=24,
        duration_ms=3000,
        seed=123,
        camera_intent=VideoCameraIntent(movement="pan-right"),
    )

    assert wf["3059"]["class_type"] == "EmptyLTXVLatentVideo"
    assert wf["3059"]["inputs"]["length"] == 73
    assert wf["3059"]["inputs"]["height"] == 736
    assert wf["9001"]["inputs"]["height"] == 720
    assert wf["4849"]["inputs"]["fps"] == 24
    assert "pan-right" in wf["2612"]["inputs"]["text"]


@pytest.mark.asyncio
async def test_ltx_execute_success(video_task: ComputeTask) -> None:
    client = AsyncMock(spec=ComfyUIClient)
    client.submit_prompt.return_value = "prompt-ltx-123"
    client.wait_for_completion.return_value = {
        "outputs": {
            "4852": {
                "animated": [True],
                "images": [
                    {"filename": "NarrativeX_Shot_00001.mp4", "subfolder": "", "type": "output"}
                ],
            }
        }
    }

    async def stream(*args, **kwargs):
        yield b"\x00\x00\x00\x20ftypisom" + b"0" * 32

    client.download_image_stream = stream

    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.upload.return_value = ProducedArtifact(
        artifact_id=video_task.artifacts.outputs[0].artifact_id,
        role="target-video",
        media_type="video/mp4",
        size_bytes=len(b"fake-mp4-video-stream-content-with-valid-header"),
        sha256="a" * 64,
    )

    executor = LtxVideoExecutor(client, artifact_adapter)
    cancel = asyncio.Event()

    context = ExecutionContext(
        save_submitting=AsyncMock(),
        save_handle=AsyncMock(),
    )

    output = await executor.execute(video_task, cancel, context)

    assert output.execution_handle == f"ltx:{executor.prompt_id(video_task)}"
    assert context.save_handle.await_count == 2
    assert len(output.outputs) == 1
    assert output.outputs[0].role == "target-video"
    artifact_adapter.upload.assert_awaited_once()


@pytest.mark.asyncio
async def test_ltx_persists_uuid_before_post_and_resumes_without_post(video_task):
    client = AsyncMock(spec=ComfyUIClient)
    artifacts = AsyncMock(spec=ArtifactPort)
    executor = LtxVideoExecutor(client, artifacts)
    events = []
    handle = f"ltx:{executor.prompt_id(video_task)}"

    async def save_handle(value):
        events.append(("handle", value))

    async def save_submitting():
        events.append(("submitting", None))

    async def submit(*args, **kwargs):
        assert events == [("handle", handle), ("submitting", None)]
        assert kwargs["prompt_id"] == handle[4:]
        raise ComfyUIClientError("Rejected graph")

    client.submit_prompt.side_effect = submit
    with pytest.raises(ExecutorExecutionError):
        await executor.execute(video_task, asyncio.Event(), ExecutionContext(
            save_handle=save_handle, save_submitting=save_submitting
        ))
    client.submit_prompt.reset_mock()
    client.wait_for_completion.side_effect = ComfyUIClientError("Known engine failure")
    with pytest.raises(ExecutorExecutionError):
        await executor.execute(video_task, asyncio.Event(), ExecutionContext(
            existing_execution_handle=handle
        ))
    client.submit_prompt.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("output", [
    {"7": {"videos": [{"filename": "fake.mp4"}]}},
    {"4852": {"images": [{"filename": "fake.png"}], "animated": [True]}},
    {"4852": {"images": [{"filename": "fake.mp4"}]}},
])
async def test_ltx_rejects_arbitrary_history_outputs(video_task, output):
    client = AsyncMock(spec=ComfyUIClient)
    artifacts = AsyncMock(spec=ArtifactPort)
    executor = LtxVideoExecutor(client, artifacts)
    client.wait_for_completion.return_value = {"outputs": output}
    with pytest.raises(ExecutorExecutionError) as error:
        await executor.execute(video_task, asyncio.Event(), ExecutionContext(
            existing_execution_handle=f"ltx:{executor.prompt_id(video_task)}"
        ))
    assert error.value.code == "VIDEO_OUTPUT_INVALID"
    artifacts.upload.assert_not_awaited()


@pytest.mark.asyncio
async def test_ltx_limits_downloaded_output_bytes(video_task):
    client = AsyncMock(spec=ComfyUIClient)
    artifacts = AsyncMock(spec=ArtifactPort)
    executor = LtxVideoExecutor(client, artifacts, max_artifact_bytes=32)
    client.wait_for_completion.return_value = {"outputs": {"4852": {
        "images": [{"filename": "out.mp4", "subfolder": "", "type": "output"}],
        "animated": [True],
    }}}

    async def stream(*args):
        yield b"\x00\x00\x00\x20ftypisom" + b"0" * 32

    client.download_image_stream = stream
    with pytest.raises(ExecutorExecutionError, match="byte limit"):
        await executor.execute(video_task, asyncio.Event(), ExecutionContext(
            existing_execution_handle=f"ltx:{executor.prompt_id(video_task)}"
        ))
    artifacts.upload.assert_not_awaited()


@pytest.mark.asyncio
async def test_ltx_execute_unsupported_model(video_task: ComputeTask) -> None:
    client = AsyncMock(spec=ComfyUIClient)
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    executor = LtxVideoExecutor(client, artifact_adapter)
    cancel = asyncio.Event()

    invalid_task = video_task.model_copy(
        update={"model": ModelRef(executor="ltx", model="unsupported-video-model", revision="1.0")}
    )

    with pytest.raises(ExecutorExecutionError) as exc_info:
        await executor.execute(invalid_task, cancel)
    assert exc_info.value.code == "VIDEO_MODEL_UNAVAILABLE"


@pytest.mark.asyncio
async def test_ltx_execute_reference_resolution_failure(video_task: ComputeTask) -> None:
    client = AsyncMock(spec=ComfyUIClient)
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.download.side_effect = RuntimeError("Failed to download reference image")
    executor = LtxVideoExecutor(client, artifact_adapter)
    cancel = asyncio.Event()

    ref_task = video_task.model_copy(
        update={
            "artifacts": TaskArtifacts(
                inputs=[
                    InputArtifactRef(
                        artifact_id=UUID("0199b86a-6db8-75b8-bd98-78442a0177df"),
                        role="character-ref",
                        media_type="image/png",
                        size_bytes=100,
                        sha256="b" * 64,
                        access=ArtifactReadAccess(
                            method="GET",
                            url="https://artifacts.local/ref.png",
                            expires_at=datetime.now(UTC) + timedelta(minutes=10),
                        ),
                    )
                ],
                outputs=video_task.artifacts.outputs,
            )
        }
    )

    with pytest.raises(ExecutorExecutionError) as exc_info:
        await executor.execute(ref_task, cancel)
    assert exc_info.value.code == "VIDEO_REFERENCE_INVALID"


@pytest.mark.asyncio
async def test_ltx_execute_generation_failure(video_task: ComputeTask) -> None:
    client = AsyncMock(spec=ComfyUIClient)
    client.submit_prompt.side_effect = ComfyUIClientError("Out of VRAM or invalid graph")
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    executor = LtxVideoExecutor(client, artifact_adapter)
    cancel = asyncio.Event()

    context = ExecutionContext(
        save_submitting=AsyncMock(),
        save_handle=AsyncMock(),
    )

    with pytest.raises(ExecutorExecutionError) as exc_info:
        await executor.execute(video_task, cancel, context)
    assert exc_info.value.code == "VIDEO_GENERATION_FAILED"


def test_build_ltx_video_workflow_i2v() -> None:
    with pytest.raises(ValueError):
        build_ltx_video_workflow(
            "prompt",
            "",
            "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
            1280,
            720,
            24,
            3000,
            0,
            generation_mode="IMAGE_TO_VIDEO",
            start_image="start.png",
        )


def test_build_ltx_video_workflow_first_last_frame() -> None:
    with pytest.raises(ValueError):
        build_ltx_video_workflow(
            "prompt",
            "",
            "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
            1280,
            720,
            24,
            3000,
            0,
            generation_mode="FIRST_LAST_FRAME",
            start_image="start.png",
            end_image="end.png",
        )


def test_build_ltx_video_workflow_with_voice_audio() -> None:
    with pytest.raises(ValueError):
        build_ltx_video_workflow(
            "prompt",
            "",
            "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
            1280,
            720,
            24,
            3000,
            0,
            generation_mode="TEXT_TO_VIDEO",
            voice_audio="voice.wav",
        )


def test_build_ltx_video_workflow_unsupported_strategy() -> None:
    with pytest.raises(ValueError, match="Unsupported generation strategy"):
        build_ltx_video_workflow(
            prompt="Extend this scene",
            negative_prompt=None,
            checkpoint="ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
            width=1280,
            height=720,
            fps=24,
            duration_ms=2000,
            seed=1,
            generation_mode="VIDEO_EXTEND",
        )


@pytest.mark.asyncio
async def test_ltx_execute_i2v_success(video_task: ComputeTask) -> None:
    client = AsyncMock(spec=ComfyUIClient)
    client.upload_file.return_value = "uploaded_ref.png"
    client.submit_prompt.return_value = "prompt-ltx-i2v"
    client.wait_for_completion.return_value = {
        "outputs": {
            "4852": {
                "animated": [True],
                "images": [
                    {"filename": "NarrativeX_Shot_00002.mp4", "subfolder": "", "type": "output"}
                ],
            }
        }
    }
    client.download_image.return_value = b"video-data-header-bytes-for-validation"

    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.download.return_value = b"fake-start-frame-bytes"
    artifact_adapter.upload.return_value = ProducedArtifact(
        artifact_id=video_task.artifacts.outputs[0].artifact_id,
        role="target-video",
        media_type="video/mp4",
        size_bytes=40,
        sha256="c" * 64,
    )

    executor = LtxVideoExecutor(client, artifact_adapter)
    cancel = asyncio.Event()

    i2v_task = video_task.model_copy(
        update={
            "inputs": video_task.inputs.model_copy(update={"generation_mode": "IMAGE_TO_VIDEO"}),
            "artifacts": TaskArtifacts(
                inputs=[
                    InputArtifactRef(
                        artifact_id=UUID("0199b86a-6db8-75b8-bd98-78442a0177df"),
                        role="start-frame",
                        media_type="image/png",
                        size_bytes=1024,
                        sha256="d" * 64,
                        access=ArtifactReadAccess(
                            method="GET",
                            url="https://artifacts.local/start.png",
                            expires_at=datetime.now(UTC) + timedelta(minutes=10),
                        ),
                    )
                ],
                outputs=video_task.artifacts.outputs,
            ),
        }
    )

    with pytest.raises(ExecutorExecutionError) as error:
        await executor.execute(i2v_task, cancel)
    assert error.value.code == "UNSUPPORTED_GENERATION_STRATEGY"
    client.upload_file.assert_not_awaited()
    client.submit_prompt.assert_not_awaited()


@pytest.mark.asyncio
async def test_ltx_execute_with_voice_reference_upload(video_task: ComputeTask) -> None:
    client = AsyncMock(spec=ComfyUIClient)
    client.upload_file.return_value = "voice_sample.wav"
    client.submit_prompt.return_value = "prompt-ltx-voice"
    client.wait_for_completion.return_value = {
        "outputs": {
            "4852": {
                "animated": [True],
                "images": [
                    {"filename": "NarrativeX_Shot_00003.mp4", "subfolder": "", "type": "output"}
                ],
            }
        }
    }
    client.download_image.return_value = b"video-with-audio-stream-content-full-32bytes"

    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.download.return_value = b"fake-voice-wav-bytes"
    artifact_adapter.upload.return_value = ProducedArtifact(
        artifact_id=video_task.artifacts.outputs[0].artifact_id,
        role="target-video",
        media_type="video/mp4",
        size_bytes=32,
        sha256="e" * 64,
    )

    executor = LtxVideoExecutor(client, artifact_adapter)
    cancel = asyncio.Event()

    voice_task = video_task.model_copy(
        update={
            "artifacts": TaskArtifacts(
                inputs=[
                    InputArtifactRef(
                        artifact_id=UUID("0199b86a-6db8-75b8-bd98-78442a0177e0"),
                        role="voice-reference",
                        media_type="audio/wav",
                        size_bytes=2048,
                        sha256="f" * 64,
                        access=ArtifactReadAccess(
                            method="GET",
                            url="https://artifacts.local/voice.wav",
                            expires_at=datetime.now(UTC) + timedelta(minutes=10),
                        ),
                    )
                ],
                outputs=video_task.artifacts.outputs,
            ),
        }
    )

    with pytest.raises(ExecutorExecutionError) as error:
        await executor.execute(voice_task, cancel)
    assert error.value.code == "VIDEO_REFERENCE_INVALID"
    client.upload_file.assert_not_awaited()
    client.submit_prompt.assert_not_awaited()


@pytest.mark.asyncio
async def test_ltx_execute_unsupported_strategy_rejected(video_task: ComputeTask) -> None:
    client = AsyncMock(spec=ComfyUIClient)
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    executor = LtxVideoExecutor(client, artifact_adapter)
    cancel = asyncio.Event()

    for strategy in ("MULTI_KEYFRAME", "VIDEO_EXTEND", "VIDEO_RETAKE"):
        unsupported_task = video_task.model_copy(
            update={"inputs": video_task.inputs.model_copy(update={"generation_mode": strategy})}
        )
        with pytest.raises(ExecutorExecutionError) as exc_info:
            await executor.execute(unsupported_task, cancel)
        assert exc_info.value.code == "UNSUPPORTED_GENERATION_STRATEGY"


@pytest.mark.asyncio
async def test_ltx_execute_i2v_missing_reference_rejected(video_task: ComputeTask) -> None:
    client = AsyncMock(spec=ComfyUIClient)
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    executor = LtxVideoExecutor(client, artifact_adapter)
    cancel = asyncio.Event()

    i2v_no_ref_task = video_task.model_copy(
        update={
            "inputs": video_task.inputs.model_copy(update={"generation_mode": "IMAGE_TO_VIDEO"}),
            "artifacts": TaskArtifacts(inputs=[], outputs=video_task.artifacts.outputs),
        }
    )
    with pytest.raises(ExecutorExecutionError) as exc_info:
        await executor.execute(i2v_no_ref_task, cancel)
    assert exc_info.value.code == "UNSUPPORTED_GENERATION_STRATEGY"
