from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
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
    assert pending[0].sequence == 2
    assert pending[1].sequence == 3

    payload_running = json.loads(pending[0].payload_json)
    assert payload_running["state"] == "RUNNING"
    assert payload_running["sequence"] == 2

    payload_succeeded = json.loads(pending[1].payload_json)
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

        async def close(self) -> None:
            pass

    service = OutboxDeliveryService(journal=journal, publisher=MockPublisher())
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

        async def close(self) -> None:
            pass

    service = OutboxDeliveryService(journal=journal, publisher=FailingPublisher())
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


@pytest.mark.asyncio
async def test_outbox_backoff_schedule_and_retry(
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
        sequence=1,
        observed_at=datetime.now(UTC),
        progress=0.1,
    )
    await journal.update(obs)

    call_count = 0

    class RetryingPublisher:
        async def publish(self, payload_json: str) -> bool:
            nonlocal call_count
            call_count += 1
            return call_count > 2

        async def close(self) -> None:
            pass

    service = OutboxDeliveryService(journal=journal, publisher=RetryingPublisher())

    # Attempt 1: fails
    delivered = await service.deliver_pending_once()
    assert delivered == 0
    assert call_count == 1

    # Right now, next_attempt_at is in the future (+1s),
    # so fetching without due_before/future returns empty
    pending_now = await journal.fetch_pending_outbox_events()
    assert len(pending_now) == 0

    # With due_before in future (+5s), event is fetched and retried
    future = datetime.now(UTC) + timedelta(seconds=5)
    pending_future = await journal.fetch_pending_outbox_events(due_before=future)
    assert len(pending_future) == 1
    assert pending_future[0].attempt_count == 1


@pytest.mark.asyncio
async def test_outbox_persistence_across_reconnect(
    tmp_path: Path, compute_task: ComputeTask
) -> None:
    db_file = tmp_path / "journal.sqlite3"
    journal1 = SqliteExecutionJournalAdapter(db_file)
    await journal1.initialize()

    task = compute_task
    await journal1.save_accepted(task)
    obs = ComputeObservation(
        task_id=task.task_id,
        attempt_id=task.attempt_id,
        state=ExecutionState.RUNNING,
        sequence=1,
        observed_at=datetime.now(UTC),
        progress=0.2,
    )
    await journal1.update(obs)

    # Re-open database with new journal adapter instance
    journal2 = SqliteExecutionJournalAdapter(db_file)
    await journal2.initialize()

    pending = await journal2.fetch_pending_outbox_events()
    assert len(pending) == 1
    assert pending[0].task_id == task.task_id
    assert pending[0].sequence == 1
