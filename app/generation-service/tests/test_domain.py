from __future__ import annotations

from uuid import uuid4

import pytest

from narrativex_gpu_worker.domain.execution_attempt import (
    AttemptState,
    ExecutionAttempt,
    InvalidExecutionTransition,
)


def attempt() -> ExecutionAttempt:
    return ExecutionAttempt.accepted(uuid4(), uuid4(), "compute:test:1", "a" * 64)


def test_execution_attempt_ignores_duplicate_or_older_observations() -> None:
    accepted = attempt()
    running, changed = accepted.apply("RUNNING", 1)

    replay, replayed = running.apply("ACCEPTED", 1)

    assert changed is True
    assert replayed is False
    assert replay == running


def test_execution_attempt_rejects_state_change_after_terminal() -> None:
    succeeded, _ = attempt().apply("SUCCEEDED", 1)

    with pytest.raises(InvalidExecutionTransition, match="terminal"):
        succeeded.apply("FAILED", 2)


def test_execution_attempt_keeps_identity_and_sequence_when_advancing() -> None:
    current = attempt()

    running, _ = current.apply(AttemptState.RUNNING.value, 1)

    assert running.task_id == current.task_id
    assert running.attempt_id == current.attempt_id
    assert running.idempotency_key == current.idempotency_key
    assert running.request_fingerprint == current.request_fingerprint
    assert running.sequence == 1
