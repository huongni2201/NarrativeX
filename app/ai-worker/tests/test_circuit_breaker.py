from narrativex_worker.circuit_breaker import ProviderCircuitBreaker


def test_circuit_breaker_opens_after_threshold_and_allows_one_probe() -> None:
    now = [0.0]
    breaker = ProviderCircuitBreaker(2, 10, clock=lambda: now[0])

    assert breaker.allow() is True
    assert breaker.record_failure() is False
    assert breaker.allow() is True
    assert breaker.record_failure() is True
    assert breaker.allow() is False

    now[0] = 10.0
    assert breaker.allow() is True
    assert breaker.allow() is False
    breaker.record_success()
    assert breaker.allow() is True


def test_circuit_breaker_failure_reopens_after_failed_probe() -> None:
    now = [0.0]
    breaker = ProviderCircuitBreaker(1, 10, clock=lambda: now[0])

    assert breaker.record_failure() is True
    now[0] = 10.0
    assert breaker.allow() is True
    assert breaker.record_failure() is True
    assert breaker.allow() is False
