"""Small in-process circuit breaker for external provider calls."""

from collections.abc import Callable
from time import monotonic


class ProviderCircuitBreaker:
    """Stop new provider calls after consecutive failures, then allow one probe."""

    def __init__(
        self,
        failure_threshold: int,
        open_seconds: float,
        *,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        if failure_threshold < 1:
            raise ValueError("failure_threshold must be positive")
        if open_seconds <= 0:
            raise ValueError("open_seconds must be positive")
        self.failure_threshold = failure_threshold
        self.open_seconds = open_seconds
        self._clock = clock
        self._failures = 0
        self._opened_until = 0.0
        self._probe_in_flight = False

    @property
    def failures(self) -> int:
        return self._failures

    @property
    def is_open(self) -> bool:
        return self._opened_until > self._clock()

    def allow(self) -> bool:
        now = self._clock()
        if self._opened_until > now:
            return False
        if self._opened_until > 0:
            if self._probe_in_flight:
                return False
            self._probe_in_flight = True
        return True

    def record_success(self) -> None:
        self._failures = 0
        self._opened_until = 0.0
        self._probe_in_flight = False

    def record_failure(self) -> bool:
        self._probe_in_flight = False
        self._failures += 1
        if self._failures >= self.failure_threshold:
            self._opened_until = self._clock() + self.open_seconds
        return self.is_open
