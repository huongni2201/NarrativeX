from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock
from uuid import UUID

import httpx
import pytest

from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.executors.qwen.client import (
    QwenClient,
    QwenClientError,
)
from narrativex_gpu_worker.adapters.executors.qwen.executor import (
    QwenExecutor,
)
from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)
from narrativex_gpu_worker.application.errors import (
    AmbiguousOutcomeError,
    ExecutionCanceledError,
    MissingDurableContextError,
)
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext
from narrativex_gpu_worker.application.services.execution import ExecutionApplicationService
from narrativex_gpu_worker.contracts import (
    ArtifactWriteAccess,
    ComputeTask,
    ExecutionState,
    ModelRef,
    OutputArtifactTarget,
    ProducedArtifact,
    TaskArtifacts,
    TaskConstraints,
    TaskDescriptor,
    TextGenerateInputs,
)
from narrativex_gpu_worker.contracts.fingerprint import request_fingerprint
from narrativex_gpu_worker.domain.submission import SubmissionState


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
    journal_events: list[str] = []

    async def save_submitting() -> None:
        journal_events.append("submitting")

    async def save_handle(handle: str) -> None:
        journal_events.append(handle)

    context = ExecutionContext(
        save_submitting=save_submitting,
        save_handle=save_handle,
    )

    output = await executor.execute(text_task, cancel, context=context)

    assert len(requests_log) == 1
    assert requests_log[0]["url"] == "http://localhost:8000/v1/chat/completions"
    assert journal_events == ["submitting", "qwen:chatcmpl-test-123"]
    assert output.execution_handle == "qwen:chatcmpl-test-123"
    assert len(output.outputs) == 1
    assert artifact_adapter.upload.await_count == 1
    uploaded_bytes = artifact_adapter.upload.call_args[0][1]
    assert uploaded_bytes == b'{"characters": ["Alice", "Bob"]}'


async def test_qwen_executor_persists_handle_before_artifact_upload_failure(
    text_task: ComputeTask,
) -> None:
    http_client, _ = create_mock_qwen_client()
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    artifact_adapter.upload.side_effect = RuntimeError("staging upload failed")
    executor = QwenExecutor(
        client=QwenClient(client=http_client),
        artifact_adapter=artifact_adapter,
    )
    saved_handles: list[str] = []

    async def save_submitting() -> None:
        return None

    async def save_handle(handle: str) -> None:
        saved_handles.append(handle)

    with pytest.raises(RuntimeError, match="staging upload failed"):
        await executor.execute(
            text_task,
            asyncio.Event(),
            context=ExecutionContext(
                save_submitting=save_submitting,
                save_handle=save_handle,
            ),
        )

    assert saved_handles == ["qwen:chatcmpl-test-123"]


async def test_qwen_executor_does_not_resubmit_existing_handle(
    text_task: ComputeTask,
) -> None:
    http_client, requests_log = create_mock_qwen_client()
    executor = QwenExecutor(
        client=QwenClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
    )

    with pytest.raises(AmbiguousOutcomeError, match="does not support resuming"):
        await executor.execute(
            text_task,
            asyncio.Event(),
            context=ExecutionContext(existing_execution_handle="qwen:chatcmpl-test-123"),
        )

    assert requests_log == []


async def test_qwen_executor_requires_durable_context_for_new_submission(
    text_task: ComputeTask,
) -> None:
    http_client, requests_log = create_mock_qwen_client()
    executor = QwenExecutor(
        client=QwenClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
    )

    with pytest.raises(MissingDurableContextError):
        await executor.execute(text_task, asyncio.Event())

    assert requests_log == []


async def test_qwen_executor_cancels_before_submit(text_task: ComputeTask) -> None:
    http_client, requests_log = create_mock_qwen_client()
    executor = QwenExecutor(
        client=QwenClient(client=http_client),
        artifact_adapter=AsyncMock(spec=ArtifactPort),
        ready=True,
    )
    cancel = asyncio.Event()
    cancel.set()

    with pytest.raises(ExecutionCanceledError, match="canceled before submit"):
        await executor.execute(text_task, cancel)
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


async def test_qwen_client_cancels_inflight_request() -> None:
    request_started = asyncio.Event()

    async def slow_handler(request: httpx.Request) -> httpx.Response:
        del request
        request_started.set()
        await asyncio.Event().wait()
        raise AssertionError("unreachable")

    client = httpx.AsyncClient(
        transport=httpx.MockTransport(slow_handler),
        base_url="http://localhost:8000/v1",
    )
    cancel = asyncio.Event()
    qwen_client = QwenClient(client=client)
    generation = asyncio.create_task(qwen_client.generate(prompt="Hello", cancel=cancel))

    await request_started.wait()
    cancel.set()

    with pytest.raises(ExecutionCanceledError):
        await asyncio.wait_for(generation, timeout=0.2)


async def test_qwen_cancellation_during_request_prevents_artifact_upload(
    text_task: ComputeTask,
) -> None:
    request_started = asyncio.Event()

    async def slow_handler(request: httpx.Request) -> httpx.Response:
        del request
        request_started.set()
        await asyncio.Event().wait()
        raise AssertionError("unreachable")

    client = httpx.AsyncClient(
        transport=httpx.MockTransport(slow_handler),
        base_url="http://localhost:8000/v1",
    )
    artifact_adapter = AsyncMock(spec=ArtifactPort)
    executor = QwenExecutor(
        client=QwenClient(client=client),
        artifact_adapter=artifact_adapter,
        ready=True,
    )
    cancel = asyncio.Event()
    submitting_called = False

    async def save_submitting() -> None:
        nonlocal submitting_called
        submitting_called = True

    async def save_handle(handle: str) -> None:
        pass

    context = ExecutionContext(
        save_submitting=save_submitting,
        save_handle=save_handle,
        correlation_key="test-key",
    )

    task_coro = asyncio.create_task(executor.execute(text_task, cancel, context))
    await request_started.wait()
    assert submitting_called is True
    cancel.set()

    with pytest.raises(ExecutionCanceledError):
        await task_coro

    artifact_adapter.upload.assert_not_called()



async def test_qwen_client_cancels_inflight_request_when_caller_is_cancelled() -> None:
    request_started = asyncio.Event()
    request_cancelled = asyncio.Event()

    async def slow_handler(request: httpx.Request) -> httpx.Response:
        del request
        request_started.set()
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            request_cancelled.set()
            raise
        raise AssertionError("unreachable")

    client = httpx.AsyncClient(
        transport=httpx.MockTransport(slow_handler),
        base_url="http://localhost:8000/v1",
    )
    generation = asyncio.create_task(QwenClient(client=client).generate(prompt="Hello"))

    await request_started.wait()
    generation.cancel()

    with pytest.raises(asyncio.CancelledError):
        await generation
    await asyncio.wait_for(request_cancelled.wait(), timeout=0.2)


async def test_qwen_recovery_does_not_regenerate_after_shutdown_during_artifact_upload(
    tmp_path: Path, text_task: ComputeTask
) -> None:
    journal = SqliteExecutionJournalAdapter(tmp_path / "journal.sqlite3")
    upload_started = asyncio.Event()
    upload_release = asyncio.Event()

    async def block_upload(*_: object) -> ProducedArtifact:
        upload_started.set()
        await upload_release.wait()
        raise AssertionError("shutdown should cancel the upload")

    first_http_client, first_requests = create_mock_qwen_client()
    first_artifacts = AsyncMock(spec=ArtifactPort)
    first_artifacts.upload.side_effect = block_upload
    first = ExecutionApplicationService(
        journal,
        ExecutorCatalog((QwenExecutor(QwenClient(client=first_http_client), first_artifacts),)),
        1,
    )
    await first.start()
    await first.submit(text_task)
    for _ in range(50):
        if upload_started.is_set():
            break
        observation = await first.get(text_task.task_id, text_task.attempt_id)
        if observation is not None and observation.state == ExecutionState.FAILED:
            pytest.fail(f"Qwen execution failed before artifact upload: {observation.error}")
        await asyncio.sleep(0.01)
    else:
        pytest.fail("Qwen execution did not reach artifact upload")
    await first.stop()

    assert len(first_requests) == 1
    assert (
        await journal.load_submission_state(text_task.task_id, text_task.attempt_id)
        == SubmissionState.SUBMITTED
    )

    second_http_client, second_requests = create_mock_qwen_client()
    second = ExecutionApplicationService(
        journal,
        ExecutorCatalog(
            (QwenExecutor(QwenClient(client=second_http_client), AsyncMock(spec=ArtifactPort)),)
        ),
        1,
    )
    await second.start()
    try:
        for _ in range(50):
            observation = await second.get(text_task.task_id, text_task.attempt_id)
            if observation is not None and observation.state == ExecutionState.FAILED:
                break
            await asyncio.sleep(0.01)
        else:
            pytest.fail("recovered Qwen attempt did not become an ambiguous failure")

        assert second_requests == []
        assert (
            await journal.load_submission_state(text_task.task_id, text_task.attempt_id)
            == SubmissionState.UNKNOWN
        )
    finally:
        upload_release.set()
        await second.stop()
