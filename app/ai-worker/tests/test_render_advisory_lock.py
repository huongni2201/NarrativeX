import pytest

from narrativex_worker.rendering import advisory_lock
from narrativex_worker.rendering.advisory_lock import (
    RenderFingerprintLockTimeout,
    render_fingerprint_lock,
)


class _FakeConnection:
    def __init__(self, try_results: list[bool]) -> None:
        self.try_results = list(try_results)
        self.queries: list[str] = []
        self.closed = False
        self.unlocked = False

    async def fetchval(self, query: str, key: str) -> bool:
        self.queries.append(query)
        assert key.startswith("narrativex:render:")
        if "pg_try_advisory_lock" in query:
            if self.try_results:
                return self.try_results.pop(0)
            return False
        if "pg_advisory_unlock" in query:
            self.unlocked = True
            return True
        raise AssertionError(f"Unexpected query: {query}")

    async def close(self) -> None:
        self.closed = True


@pytest.mark.asyncio
async def test_render_fingerprint_lock_acquires_and_releases(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = _FakeConnection([True])

    async def connect(_: str) -> _FakeConnection:
        return connection

    monkeypatch.setattr(advisory_lock.asyncpg, "connect", connect)

    async with render_fingerprint_lock("postgresql://test", "abc"):
        assert not connection.unlocked

    assert connection.unlocked
    assert connection.closed
    assert any("pg_try_advisory_lock" in query for query in connection.queries)


@pytest.mark.asyncio
async def test_render_fingerprint_lock_retries_then_acquires(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = _FakeConnection([False, True])

    async def connect(_: str) -> _FakeConnection:
        return connection

    monkeypatch.setattr(advisory_lock.asyncpg, "connect", connect)

    async with render_fingerprint_lock(
        "postgresql://test", "abc", timeout_seconds=0.1, poll_interval_seconds=0.001
    ):
        pass

    assert sum("pg_try_advisory_lock" in query for query in connection.queries) == 2
    assert connection.unlocked
    assert connection.closed


@pytest.mark.asyncio
async def test_render_fingerprint_lock_times_out_without_unlocking(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = _FakeConnection([False])

    async def connect(_: str) -> _FakeConnection:
        return connection

    monkeypatch.setattr(advisory_lock.asyncpg, "connect", connect)

    with pytest.raises(RenderFingerprintLockTimeout):
        async with render_fingerprint_lock(
            "postgresql://test", "abc", timeout_seconds=0.005, poll_interval_seconds=0.005
        ):
            raise AssertionError("lock context must not be entered")

    assert not connection.unlocked
    assert connection.closed
