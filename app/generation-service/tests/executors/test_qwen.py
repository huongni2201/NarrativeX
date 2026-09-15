from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock
from uuid import UUID

import httpx
import pytest

from narrativex_gpu_worker.adapters.executors.qwen.client import (
    QwenClient,
    QwenClientError,
)
from narrativex_gpu_worker.adapters.executors.qwen.executor import (
    QwenExecutor,
)
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
    TextGenerateInputs,
)
from narrativex_gpu_worker.contracts.fingerprint import request_fingerprint


@pytest.fixture
def text_task() -> ComputeTask:
    task_id = UUID("0199b861-cc3c-7a8e-a915-e5dbff3af7bb")
    attempt_id = UUID("0199b862-1025-78be-bd71-c6969b74ab72")
    task = ComputeTask(
        protocol_version="1.0",
        task_id=task_id,
        attempt_id=attempt_id,
        idempotency_key="compute:qwen:1",
        request_fingerprint="0" * 64,
        task=TaskDescriptor(type="text.generate", schema_version="1.0"),
        model=ModelRef(executor="qwen", model="Qwen/Qwen3-8B-AWQ", revision="default"),
        constraints=TaskConstraints(
            deadline=datetime.now(UTC) + timedelta(minutes=10),
            max_runtime_seconds=300,
        ),
        inputs=TextGenerateInputs(
            prompt="Analyze the following scene...",
            system_prompt="You are an expert story director.",
            temperature=0.2,
            top_p=0.8,
            max_tokens=2048,
            response_format="json_object",
        ),
        artifacts=TaskArtifacts(
            inputs=[],
            outputs=[
                OutputArtifactTarget(
                    artifact_id=UUID("0199b86a-6db8-75b8-bd98-78442a0177ee"),
                    role="analysis",
                    media_type="application/json",
                    access=ArtifactWriteAccess(
                        method="PUT",
                        url="https://example.com/staging/analysis.json",
                        expires_at=datetime.now(UTC) + timedelta(hours=1),
                    ),
                )
            ],
        ),
    )
    task.request_fingerprint = request_fingerprint(task)
    return task


def create_mock_qwen_client() -> tuple[httpx.AsyncClient, list[dict[str, Any]]]:
    requests_log: list[dict[str, Any]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests_log.append({
            "method": request.method,
            "url": str(request.url),
            "headers": dict(request.headers),
            "content": request.read().decode("utf-8"),
        })
        return httpx.Response(
            200,
            json={
                "id": "chatcmpl-test-123",
                "object": "chat.completion",
                "created": 1720000000,
                "model": "Qwen/Qwen3-8B-AWQ",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": '{"characters": ["Alice", "Bob"]}',
                        },
                        "finish_reason": "stop",
                    }
                ],
            },
        )

    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://localhost:8000/v1")
    return client, requests_log


def test_qwen_executor_properties() -> None:
    http_client, _ = create_mock_qwen_client()
    executor = QwenExecutor(
        client=QwenClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
        ready=True,
    )
    assert executor.name == "qwen"
    assert "text.generate" in executor.task_types
    assert executor.ready is True
    assert any(m.model == "Qwen/Qwen3-8B-AWQ" for m in executor.models)


async def test_qwen_executor_executes_and_uploads_artifact(text_task: ComputeTask) -> None:
    http_client, requests_log = create_mock_qwen_client()
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.upload.return_value = ProducedArtifact(
        artifact_id=text_task.artifacts.outputs[0].artifact_id,
        role="analysis",
        media_type="application/json",
        size_bytes=32,
        sha256="c" * 64,
    )

    executor = QwenExecutor(
        client=QwenClient(client=http_client),
        artifact_adapter=artifact_adapter,
        ready=True,
    )
    cancel = asyncio.Event()
    save_handle_mock = AsyncMock()
    context = ExecutionContext(save_handle=save_handle_mock)

    output = await executor.execute(text_task, cancel, context=context)

    assert len(requests_log) == 1
    assert requests_log[0]["url"] == "http://localhost:8000/v1/chat/completions"
    assert save_handle_mock.await_count == 1
    assert save_handle_mock.call_args[0][0] == "qwen:chatcmpl-test-123"
    assert output.execution_handle == "qwen:chatcmpl-test-123"
    assert len(output.outputs) == 1
    assert artifact_adapter.upload.await_count == 1
    uploaded_bytes = artifact_adapter.upload.call_args[0][1]
    assert uploaded_bytes == b'{"characters": ["Alice", "Bob"]}'


async def test_qwen_executor_cancellation_returns_early(text_task: ComputeTask) -> None:
    http_client, requests_log = create_mock_qwen_client()
    executor = QwenExecutor(
        client=QwenClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
        ready=True,
    )
    cancel = asyncio.Event()
    cancel.set()

    output = await executor.execute(text_task, cancel)
    assert len(output.outputs) == 0
    assert len(requests_log) == 0


async def test_qwen_client_error_handling() -> None:
    async def error_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Model Error")

    transport = httpx.MockTransport(error_handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://localhost:8000/v1")
    qwen_client = QwenClient(client=client)

    with pytest.raises(QwenClientError, match="HTTP 500"):
        await qwen_client.generate(prompt="Hello")


async def test_qwen_client_invalid_payload_handling() -> None:
    async def invalid_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": "empty", "choices": []})

    transport = httpx.MockTransport(invalid_handler)
    client = httpx.AsyncClient(transport=transport, base_url="http://localhost:8000/v1")
    qwen_client = QwenClient(client=client)

    with pytest.raises(QwenClientError, match="missing choices"):
        await qwen_client.generate(prompt="Hello")
