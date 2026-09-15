from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from pydantic import SecretStr

from conftest import FakeExecutor, task_payload
from narrativex_gpu_worker.adapters.executors import ExecutorCatalog
from narrativex_gpu_worker.adapters.inbound.http import MEDIA_TYPE
from narrativex_gpu_worker.bootstrap import create_app
from narrativex_gpu_worker.config import WorkerSettings
from narrativex_gpu_worker.contracts import ComputeTask, request_fingerprint


def settings(tmp_path: Path) -> WorkerSettings:
    return WorkerSettings(
        machine_token=SecretStr("test-machine-token"),
        journal_file=tmp_path / "journal.sqlite3",
        max_request_bytes=10_000,
    )


def auth() -> dict[str, str]:
    return {"Authorization": "Bearer test-machine-token"}


def proto_headers(idempotency_key: str | None = None) -> dict[str, str]:
    headers = {**auth(), "Content-Type": MEDIA_TYPE}
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    return headers


async def request(app: object, method: str, target: str, **kwargs: object) -> httpx.Response:
    async with app.router.lifespan_context(app):  # type: ignore[attr-defined]
        transport = httpx.ASGITransport(app=app)  # type: ignore[arg-type]
        async with httpx.AsyncClient(transport=transport, base_url="http://worker.test") as client:
            return await client.request(method, target, **kwargs)


async def test_protected_endpoint_requires_machine_credential(tmp_path: Path) -> None:
    response = await request(create_app(settings(tmp_path)), "GET", "/v1/capabilities")
    assert response.status_code == 401


async def test_capabilities_returns_protocol_media_type(tmp_path: Path) -> None:
    response = await request(
        create_app(settings(tmp_path)), "GET", "/v1/capabilities", headers=auth()
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith(MEDIA_TYPE)
    assert response.json()["executors"] == []


async def test_health_endpoint_returns_json(tmp_path: Path) -> None:
    response = await request(create_app(settings(tmp_path)), "GET", "/healthz")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"status": "UP"}


async def test_submit_and_reconcile_attempt(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), ExecutorCatalog((FakeExecutor(),)))
    payload = task_payload()
    headers = proto_headers(payload["idempotencyKey"])
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://worker.test") as client:
            content = json.dumps(payload).encode("utf-8")
            accepted = await client.post("/v1/tasks", headers=headers, content=content)
            assert accepted.status_code == 202
            assert accepted.headers["content-type"].startswith(MEDIA_TYPE)
            result = await client.get(
                f"/v1/tasks/{payload['taskId']}/attempts/{payload['attemptId']}",
                headers=auth(),
            )
        assert accepted.status_code == 202
    assert result.status_code == 200
    assert result.headers["content-type"].startswith(MEDIA_TYPE)
    assert result.json()["state"] in {"ACCEPTED", "RUNNING", "SUCCEEDED"}


async def test_submit_rejects_wrong_content_type(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), ExecutorCatalog((FakeExecutor(),)))
    payload = task_payload()
    headers = {
        **auth(),
        "Content-Type": "application/json",
        "Idempotency-Key": payload["idempotencyKey"],
    }
    response = await request(
        app,
        "POST",
        "/v1/tasks",
        headers=headers,
        content=json.dumps(payload).encode("utf-8"),
    )
    assert response.status_code == 415


async def test_submit_rejects_header_body_idempotency_mismatch(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), ExecutorCatalog((FakeExecutor(),)))
    response = await request(
        app,
        "POST",
        "/v1/tasks",
        headers=proto_headers("different"),
        content=json.dumps(task_payload()).encode("utf-8"),
    )
    assert response.status_code == 409


async def test_submit_rejects_noncanonical_fingerprint(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), ExecutorCatalog((FakeExecutor(),)))
    payload = task_payload()
    payload["requestFingerprint"] = "f" * 64
    response = await request(
        app,
        "POST",
        "/v1/tasks",
        headers=proto_headers(payload["idempotencyKey"]),
        content=json.dumps(payload).encode("utf-8"),
    )
    assert response.status_code == 409


async def test_submit_rejects_unsupported_executor(tmp_path: Path) -> None:
    payload = task_payload()
    response = await request(
        create_app(settings(tmp_path)),
        "POST",
        "/v1/tasks",
        headers=proto_headers(payload["idempotencyKey"]),
        content=json.dumps(payload).encode("utf-8"),
    )
    assert response.status_code == 422


async def test_submit_rejects_expired_task(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), ExecutorCatalog((FakeExecutor(),)))
    payload = task_payload()
    payload["constraints"]["deadline"] = (
        (datetime.now(UTC) - timedelta(minutes=5)).isoformat().replace("+00:00", "Z")
    )
    payload["requestFingerprint"] = request_fingerprint(ComputeTask.model_validate(payload))

    response = await request(
        app,
        "POST",
        "/v1/tasks",
        headers=proto_headers(payload["idempotencyKey"]),
        content=json.dumps(payload).encode("utf-8"),
    )
    assert response.status_code == 422


async def test_submit_enforces_request_size_limit(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), ExecutorCatalog((FakeExecutor(),)))
    huge_body = b"x" * 20_000  # Exceeds max_request_bytes = 10_000
    response = await request(
        app,
        "POST",
        "/v1/tasks",
        headers=proto_headers("key"),
        content=huge_body,
    )
    assert response.status_code == 413
