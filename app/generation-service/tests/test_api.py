from __future__ import annotations

from pathlib import Path

import httpx
from pydantic import SecretStr

from conftest import FakeExecutor, task_payload
from narrativex_gpu_worker.adapters.executors import ExecutorRegistry
from narrativex_gpu_worker.adapters.inbound.http import create_app
from narrativex_gpu_worker.config import WorkerSettings


def settings(tmp_path: Path) -> WorkerSettings:
    return WorkerSettings(
        machine_token=SecretStr("test-machine-token"),
        journal_file=tmp_path / "journal.sqlite3",
    )


def auth() -> dict[str, str]:
    return {"Authorization": "Bearer test-machine-token"}


async def request(app: object, method: str, target: str, **kwargs: object) -> httpx.Response:
    async with app.router.lifespan_context(app):  # type: ignore[attr-defined]
        transport = httpx.ASGITransport(app=app)  # type: ignore[arg-type]
        async with httpx.AsyncClient(transport=transport, base_url="http://worker.test") as client:
            return await client.request(method, target, **kwargs)


async def test_protected_endpoint_requires_machine_credential(tmp_path: Path) -> None:
    response = await request(create_app(settings(tmp_path)), "GET", "/v1/capabilities")
    assert response.status_code == 401


async def test_capabilities_do_not_claim_unregistered_executor_readiness(tmp_path: Path) -> None:
    response = await request(
        create_app(settings(tmp_path)), "GET", "/v1/capabilities", headers=auth()
    )
    assert response.status_code == 200
    assert response.json()["executors"] == []


async def test_submit_and_reconcile_attempt(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), ExecutorRegistry((FakeExecutor(),)))
    payload = task_payload()
    headers = {**auth(), "Idempotency-Key": payload["idempotencyKey"]}
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://worker.test") as client:
            accepted = await client.post("/v1/tasks", headers=headers, json=payload)
            assert accepted.status_code == 202
            result = await client.get(
                f"/v1/tasks/{payload['taskId']}/attempts/{payload['attemptId']}",
                headers=auth(),
            )
        assert accepted.status_code == 202
    assert result.status_code == 200
    assert result.json()["state"] in {"ACCEPTED", "RUNNING", "SUCCEEDED"}


async def test_submit_rejects_header_body_idempotency_mismatch(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), ExecutorRegistry((FakeExecutor(),)))
    response = await request(
        app,
        "POST",
        "/v1/tasks",
        headers={**auth(), "Idempotency-Key": "different"},
        json=task_payload(),
    )
    assert response.status_code == 409


async def test_submit_rejects_noncanonical_fingerprint(tmp_path: Path) -> None:
    app = create_app(settings(tmp_path), ExecutorRegistry((FakeExecutor(),)))
    payload = task_payload()
    payload["requestFingerprint"] = "f" * 64
    response = await request(
        app,
        "POST",
        "/v1/tasks",
        headers={**auth(), "Idempotency-Key": payload["idempotencyKey"]},
        json=payload,
    )
    assert response.status_code == 409


async def test_submit_rejects_unsupported_executor(tmp_path: Path) -> None:
    payload = task_payload()
    response = await request(
        create_app(settings(tmp_path)),
        "POST",
        "/v1/tasks",
        headers={**auth(), "Idempotency-Key": payload["idempotencyKey"]},
        json=payload,
    )
    assert response.status_code == 422
