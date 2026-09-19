from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest

from narrativex_gpu_worker.adapters.events.http_compute_event_publisher import (
    HttpComputeEventPublisher,
)
from narrativex_gpu_worker.adapters.persistence.sqlite_execution_journal import (
    SqliteExecutionJournalAdapter,
)
from narrativex_gpu_worker.application.services.outbox_delivery_service import (
    OutboxDeliveryService,
)
from narrativex_gpu_worker.contracts import (
    ComputeObservation,
    ComputeTask,
    ExecutionState,
)


@pytest.mark.asyncio
async def test_outbox_records_events_on_state_transition(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    db_file = tmp_path / "journal.sqlite3"
    journal = SqliteExecutionJournalAdapter(db_file)
    await journal.initialize()

    task = compute_task
    _, is_new = await journal.save_accepted(task)
    assert is_new is True

    # Transition to RUNNING
    obs_running = ComputeObservation(
        task_id=task.task_id,
        attempt_id=task.attempt_id,
        state=ExecutionState.RUNNING,
        sequence=2,
        observed_at=datetime.now(UTC),
        progress=0.25,
    )
    await journal.update(obs_running)

    # Transition to SUCCEEDED
    obs_succeeded = ComputeObservation(
        task_id=task.task_id,
        attempt_id=task.attempt_id,
        state=ExecutionState.SUCCEEDED,
        sequence=3,
        observed_at=datetime.now(UTC),
        progress=1.0,
    )
    await journal.update(obs_succeeded)

    pending = await journal.fetch_pending_outbox_events()
    assert len(pending) == 2
    assert pending[0]["sequence"] == 2
    assert pending[1]["sequence"] == 3

    payload_running = json.loads(pending[0]["payload_json"])
    assert payload_running["state"] == "RUNNING"
    assert payload_running["sequence"] == 2

    payload_succeeded = json.loads(pending[1]["payload_json"])
    assert payload_succeeded["state"] == "SUCCEEDED"
    assert payload_succeeded["sequence"] == 3


@pytest.mark.asyncio
async def test_outbox_delivery_service_delivers_pending_events(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    db_file = tmp_path / "journal.sqlite3"
    journal = SqliteExecutionJournalAdapter(db_file)
    await journal.initialize()

    task = compute_task
    await journal.save_accepted(task)

    obs = ComputeObservation(
        task_id=task.task_id,
        attempt_id=task.attempt_id,
        state=ExecutionState.RUNNING,
        sequence=2,
        observed_at=datetime.now(UTC),
        progress=0.5,
    )
    await journal.update(obs)

    published_payloads: list[str] = []

    class MockPublisher:
        async def publish(self, payload_json: str) -> bool:
            published_payloads.append(payload_json)
            return True

    service = OutboxDeliveryService(journal=journal, publisher=MockPublisher())  # type: ignore[arg-type]
    delivered = await service.deliver_pending_once()
    assert delivered == 1
    assert len(published_payloads) == 1

    remaining = await journal.fetch_pending_outbox_events()
    assert len(remaining) == 0


@pytest.mark.asyncio
async def test_compute_state_remains_succeeded_when_callback_delivery_fails(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    db_file = tmp_path / "journal.sqlite3"
    journal = SqliteExecutionJournalAdapter(db_file)
    await journal.initialize()

    task = compute_task
    await journal.save_accepted(task)

    obs = ComputeObservation(
        task_id=task.task_id,
        attempt_id=task.attempt_id,
        state=ExecutionState.SUCCEEDED,
        sequence=2,
        observed_at=datetime.now(UTC),
        progress=1.0,
    )
    await journal.update(obs)

    # Publisher that consistently fails (e.g. backend offline)
    class FailingPublisher:
        async def publish(self, payload_json: str) -> bool:
            return False

    service = OutboxDeliveryService(journal=journal, publisher=FailingPublisher())  # type: ignore[arg-type]
    delivered = await service.deliver_pending_once()
    assert delivered == 0

    # Invariant check: attempt state MUST still be SUCCEEDED
    attempt = await journal.load(task.task_id, task.attempt_id)
    assert attempt is not None
    assert attempt.state == ExecutionState.SUCCEEDED

    # Outbox event remains PENDING with attempt_count incremented
    with journal._connect() as conn:
        row = conn.execute(
            "SELECT delivery_state, attempt_count, next_attempt_at FROM compute_event_outbox"
        ).fetchone()
        assert row["delivery_state"] == "PENDING"
        assert row["attempt_count"] == 1


@pytest.mark.asyncio
async def test_publisher_signs_with_hmac_and_headers() -> None:
    captured_requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        return httpx.Response(200, json={"status": "PROCESSED"})

    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport)

    secret = "my-shared-secret-key"
    publisher = HttpComputeEventPublisher(
        callback_url="http://backend.internal/internal/compute/events",
        shared_secret=secret,
        http_client=client,
    )

    payload = json.dumps({"eventId": "evt_test", "state": "SUCCEEDED"})
    success = await publisher.publish(payload)
    assert success is True
    assert len(captured_requests) == 1

    req = captured_requests[0]
    timestamp = req.headers.get("X-NarrativeX-Compute-Timestamp")
    signature = req.headers.get("X-NarrativeX-Compute-Signature")
    assert timestamp is not None
    assert signature is not None

    to_sign = f"{timestamp}.{payload}".encode()
    expected_sig = hmac.new(secret.encode("utf-8"), to_sign, hashlib.sha256).hexdigest()
    assert signature == expected_sig

    await publisher.close()
