import pytest

from narrativex_worker.runtime.retry_policy import (
    UNKNOWN_RECONCILIATION_POLICY,
    RetryPolicy,
)


def test_retry_policy_is_bounded_and_deterministic() -> None:
    policy = RetryPolicy(max_attempts=3, base_delay_seconds=1, multiplier=2, max_delay_seconds=3)
    assert [policy.delay_seconds(attempt) for attempt in range(5)] == [1, 2, 3, 3, 3]
    assert policy.can_retry(0)
    assert not policy.can_retry(3)


def test_unknown_reconciliation_policy_rejects_negative_attempt() -> None:
    with pytest.raises(ValueError, match="non-negative"):
        UNKNOWN_RECONCILIATION_POLICY.delay_seconds(-1)
