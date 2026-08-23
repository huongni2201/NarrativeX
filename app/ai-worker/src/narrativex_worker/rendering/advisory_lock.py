"""PostgreSQL advisory locks for serializing external render side effects."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg  # type: ignore[import-untyped]


class RenderFingerprintLockTimeout(TimeoutError):
    """Raised when another worker keeps the fingerprint lock past the configured deadline."""


@asynccontextmanager
async def render_fingerprint_lock(
    database_url: str,
    render_fingerprint: str,
    *,
    timeout_seconds: float = 30.0,
    poll_interval_seconds: float = 0.5,
) -> AsyncIterator[None]:
    """Serialize Drive upload + render persistence for one immutable fingerprint.

    Uses a session-scoped try-lock with a bounded wait so a contended render cannot block a worker
    forever. The same PostgreSQL connection remains open for the entire context.
    """
    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be positive")
    if poll_interval_seconds <= 0:
        raise ValueError("poll_interval_seconds must be positive")

    connection = await asyncpg.connect(database_url)
    key = f"narrativex:render:{render_fingerprint}"
    acquired = False
    try:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout_seconds
        while True:
            acquired = bool(
                await connection.fetchval(
                    "SELECT pg_try_advisory_lock(hashtextextended($1, 0))",
                    key,
                )
            )
            if acquired:
                break
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise RenderFingerprintLockTimeout(
                    f"Timed out acquiring render fingerprint lock after {timeout_seconds:.1f}s"
                )
            await asyncio.sleep(min(poll_interval_seconds, remaining))

        try:
            yield
        finally:
            await connection.fetchval(
                "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
                key,
            )
    finally:
        await connection.close()
