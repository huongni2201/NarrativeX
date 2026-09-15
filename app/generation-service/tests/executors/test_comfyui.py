from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock
from uuid import UUID

import httpx
import pytest

from narrativex_gpu_worker.adapters.executors.comfyui.client import (
    ComfyUIClient,
    ComfyUIClientError,
)
from narrativex_gpu_worker.adapters.executors.comfyui.executor import ComfyUIExecutor
from narrativex_gpu_worker.application.errors import MissingDurableContextError
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext
from narrativex_gpu_worker.contracts import (
    ArtifactReadAccess,
    ArtifactWriteAccess,
    ComputeTask,
    ImageGenerateInputs,
    InputArtifactRef,
    ModelRef,
    OutputArtifactTarget,
    ProducedArtifact,
    TaskArtifacts,
    TaskConstraints,
    TaskDescriptor,
)
from narrativex_gpu_worker.contracts.fingerprint import request_fingerprint


@pytest.fixture
def image_task() -> ComputeTask:
    task_id = UUID("0199b861-cc3c-7a8e-a915-e5dbff3af7aa")
    attempt_id = UUID("0199b862-1025-78be-bd71-c6969b74ab71")
    task = ComputeTask(
        protocol_version="1.0",
        task_id=task_id,
        attempt_id=attempt_id,
        idempotency_key="compute:image:1",
        request_fingerprint="0" * 64,
        task=TaskDescriptor(type="image.generate", schema_version="1.0"),
        model=ModelRef(executor="comfyui", model="realvisxl", revision="5.0"),
        constraints=TaskConstraints(
            deadline=datetime.now(UTC) + timedelta(minutes=10),
            max_runtime_seconds=300,
        ),
        inputs=ImageGenerateInputs(
            prompt="A cinematic photo of a mountain",
            negative_prompt="blurry, low quality",
            width=1024,
            height=1024,
            seed=42,
        ),
        artifacts=TaskArtifacts(
            inputs=[],
            outputs=[
                OutputArtifactTarget(
                    artifact_id=UUID("0199b86a-6db8-75b8-bd98-78442a0177de"),
                    role="image",
                    media_type="image/png",
                    access=ArtifactWriteAccess(
                        method="PUT",
                        url="https://example.com/staging/out.png",
                        expires_at=datetime.now(UTC) + timedelta(hours=1),
                    ),
                )
            ],
        ),
    )
    task.request_fingerprint = request_fingerprint(task)
    return task


def create_mock_transport() -> tuple[httpx.AsyncClient, list[dict[str, Any]]]:
    requests_log: list[dict[str, Any]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests_log.append({"method": request.method, "url": str(request.url)})
        path = request.url.path
        if path == "/prompt":
            return httpx.Response(200, json={"prompt_id": "comfy-test-123"})
        elif path.startswith("/history/"):
            return httpx.Response(
                200,
                json={
                    "comfy-test-123": {
                        "status": {"completed": True, "status_str": "success"},
                        "outputs": {
                            "9": {
                                "images": [
                                    {"filename": "rendered.png", "subfolder": "", "type": "output"}
                                ]
                            }
                        },
                    }
                },
            )
        elif path == "/view":
            return httpx.Response(200, content=b"\x89PNG\r\n\x1a\n\x00fakeimage")
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://127.0.0.1:8188")
    return client, requests_log


async def test_comfyui_executor_enforces_durable_context(image_task: ComputeTask) -> None:
    http_client, requests_log = create_mock_transport()
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    executor = ComfyUIExecutor(
        client=ComfyUIClient(client=http_client),
        artifact_adapter=artifact_adapter,
        ready=True,
    )
    cancel = asyncio.Event()

    # Context None
    with pytest.raises(MissingDurableContextError):
        await executor.execute(image_task, cancel, context=None)
    assert len(requests_log) == 0

    # Context with missing save_submitting or save_handle
    with pytest.raises(MissingDurableContextError):
        await executor.execute(
            image_task,
            cancel,
            context=ExecutionContext(existing_execution_handle=None, save_submitting=None, save_handle=None),
        )
    assert len(requests_log) == 0


async def test_comfyui_executor_lifecycle_and_handle_saving(image_task: ComputeTask) -> None:
    http_client, requests_log = create_mock_transport()
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.upload.return_value = ProducedArtifact(
        artifact_id=image_task.artifacts.outputs[0].artifact_id,
        role="image",
        media_type="image/png",
        size_bytes=16,
        sha256="a" * 64,
    )

    executor = ComfyUIExecutor(
        client=ComfyUIClient(client=http_client),
        artifact_adapter=artifact_adapter,
        ready=True,
    )
    cancel = asyncio.Event()

    call_order: list[str] = []

    async def mock_save_submitting() -> None:
        call_order.append("submitting")

    async def mock_save_handle(handle: str) -> None:
        call_order.append(f"handle:{handle}")

    context = ExecutionContext(
        existing_execution_handle=None,
        save_submitting=mock_save_submitting,
        save_handle=mock_save_handle,
    )

    output = await executor.execute(image_task, cancel, context=context)

    assert call_order == ["submitting", "handle:comfyui:comfy-test-123"]
    assert output.execution_handle == "comfyui:comfy-test-123"
    assert len(output.outputs) == 1
    assert artifact_adapter.upload.await_count == 1

    # Check HTTP requests made: /prompt -> /history -> /view
    methods_and_paths = [(r["method"], r["url"]) for r in requests_log]
    assert any("/prompt" in url for _, url in methods_and_paths)
    assert any("/history/comfy-test-123" in url for _, url in methods_and_paths)
    assert any("/view" in url for _, url in methods_and_paths)


async def test_comfyui_executor_resumes_with_existing_handle_without_resubmit(
    image_task: ComputeTask,
) -> None:
    http_client, requests_log = create_mock_transport()
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.upload.return_value = ProducedArtifact(
        artifact_id=image_task.artifacts.outputs[0].artifact_id,
        role="image",
        media_type="image/png",
        size_bytes=16,
        sha256="a" * 64,
    )

    executor = ComfyUIExecutor(
        client=ComfyUIClient(client=http_client),
        artifact_adapter=artifact_adapter,
        ready=True,
    )
    cancel = asyncio.Event()

    save_submitting_mock = AsyncMock()
    save_handle_mock = AsyncMock()

    # Pass existing handle
    context = ExecutionContext(
        existing_execution_handle="comfyui:comfy-test-123",
        save_submitting=save_submitting_mock,
        save_handle=save_handle_mock,
    )

    output = await executor.execute(image_task, cancel, context=context)

    # Must NOT call save_submitting, must NOT call submit_prompt!
    assert save_submitting_mock.await_count == 0
    assert output.execution_handle == "comfyui:comfy-test-123"

    # Verify no POST /prompt was issued
    for req in requests_log:
        assert "/prompt" not in req["url"]
    # Verify GET /history was issued
    assert any("/history/comfy-test-123" in req["url"] for req in requests_log)


async def test_comfyui_client_error_redacts_sensitive_payload() -> None:
    async def error_handler(request: httpx.Request) -> httpx.Response:
        # Simulate server error leaking prompt details
        return httpx.Response(
            500,
            text="Internal Error: Prompt 'SECRET_PROMPT_TEXT' cannot be processed by node 42",
        )

    transport = httpx.MockTransport(error_handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://127.0.0.1:8188")
    comfy_client = ComfyUIClient(client=client)

    with pytest.raises(ComfyUIClientError) as exc_info:
        await comfy_client.submit_prompt(
            workflow={"prompt": "SECRET_PROMPT_TEXT"}, client_id="test"
        )
    # Ensure SECRET_PROMPT_TEXT is not in the raised message
    assert "SECRET_PROMPT_TEXT" not in str(exc_info.value)
    assert "HTTP 500" in str(exc_info.value)


async def test_comfyui_executor_cancellation_returns_early(image_task: ComputeTask) -> None:
    http_client, requests_log = create_mock_transport()
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    executor = ComfyUIExecutor(
        client=ComfyUIClient(client=http_client),
        artifact_adapter=artifact_adapter,
        ready=True,
    )
    cancel = asyncio.Event()
    cancel.set()

    output = await executor.execute(image_task, cancel)
    assert len(output.outputs) == 0
    assert len(requests_log) == 0
