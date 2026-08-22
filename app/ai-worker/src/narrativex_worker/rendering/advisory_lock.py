"""PostgreSQL advisory locks for serializing external render side effects."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg  # type: ignore[import-untyped]


@asynccontextmanager
async def render_fingerprint_lock(
    database_url: str, render_fingerprint: str
) -> AsyncIterator[None]:
    """Serialize Drive upload + render persistence for one immutable fingerprint.

    The lock is session-scoped and therefore works across worker processes/replicas. Keeping the
    same PostgreSQL connection open for the context guarantees the lock cannot be accidentally
    transferred to another pooled connection.
    """
    connection = await asyncpg.connect(database_url)
    try:
        await connection.execute(
            "SELECT pg_advisory_lock(hashtextextended($1, 0))",
            f"narrativex:render:{render_fingerprint}",
        )
        try:
            yield
        finally:
            await connection.execute(
                "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
                f"narrativex:render:{render_fingerprint}",
            )
    finally:
        await connection.close()
