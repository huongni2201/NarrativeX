"""Deterministic retry and reconciliation policies shared by job runners.

Provider submission is intentionally not represented as a retryable operation here:
callers must persist an UNKNOWN outcome and reconcile it before attempting another
submission. The policy only calculates bounded scheduling decisions.
"""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    max_attempts: int
    base_delay_seconds: float
    multiplier: float = 2.0
    max_delay_seconds: float = 300.0

    def __post_init__(self) -> None:
        if self.max_attempts < 1:
            raise ValueError("max_attempts must be positive")
        if self.base_delay_seconds < 0:
            raise ValueError("base_delay_seconds must be non-negative")
        if self.multiplier < 1:
            raise ValueError("multiplier must be at least 1")
        if self.max_delay_seconds < self.base_delay_seconds:
            raise ValueError("max_delay_seconds must not be smaller than base_delay_seconds")

    def delay_seconds(self, attempt: int) -> float:
        if attempt < 0:
            raise ValueError("attempt must be non-negative")
        return min(
            self.max_delay_seconds,
            self.base_delay_seconds * (self.multiplier**attempt),
        )

    def can_retry(self, completed_attempts: int) -> bool:
        if completed_attempts < 0:
            raise ValueError("completed_attempts must be non-negative")
        return completed_attempts < self.max_attempts


LOCAL_IO_RETRY_POLICY = RetryPolicy(
    max_attempts=3,
    base_delay_seconds=0.25,
    multiplier=4.0,
    max_delay_seconds=2.0,
)

UNKNOWN_RECONCILIATION_POLICY = RetryPolicy(
    max_attempts=8,
    base_delay_seconds=5.0,
    multiplier=2.0,
    max_delay_seconds=300.0,
)
