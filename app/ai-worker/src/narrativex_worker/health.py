"""Minimal worker health endpoint with a live PostgreSQL round-trip."""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import suppress

import asyncpg  # type: ignore[import-untyped]

logger = logging.getLogger("narrativex.worker.health")


class WorkerHealthServer:
    """Serve container health probes without adding another HTTP dependency.

    A successful probe proves both that the supervisor event loop is responsive and that the
    worker can still reach PostgreSQL, the authoritative queue/state store.
    """

    def __init__(
        self,
        database_url: str,
        port: int,
        *,
        host: str = "127.0.0.1",
        database_timeout_seconds: float = 3.0,
    ) -> None:
        self.database_url = database_url
        self.host = host
        self.port = port
        self.database_timeout_seconds = database_timeout_seconds
        self._server: asyncio.Server | None = None

    async def start(self) -> None:
        if self._server is not None:
            return
        self._server = await asyncio.start_server(self._handle_connection, self.host, self.port)
        logger.info("Worker health endpoint listening on %s:%s", self.host, self.port)

    async def close(self) -> None:
        if self._server is None:
            return
        self._server.close()
        await self._server.wait_closed()
        self._server = None

    async def _database_healthy(self) -> bool:
        connection: asyncpg.Connection | None = None
        try:
            connection = await asyncpg.connect(
                self.database_url,
                timeout=self.database_timeout_seconds,
                command_timeout=self.database_timeout_seconds,
            )
            return bool(await connection.fetchval("SELECT 1") == 1)
        except Exception as exception:
            logger.warning("Worker health database probe failed: %s", type(exception).__name__)
            return False
        finally:
            if connection is not None:
                with suppress(Exception):
                    await connection.close(timeout=self.database_timeout_seconds)

    async def _handle_connection(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        status_code = 500
        status_text = "Internal Server Error"
        payload: dict[str, object] = {"status": "error"}
        try:
            request_line = await asyncio.wait_for(reader.readline(), timeout=2.0)
            method, path, _ = request_line.decode("ascii", errors="replace").strip().split(" ", 2)
            await self._discard_headers(reader)
            if method != "GET" or path not in {"/healthz", "/readyz"}:
                status_code = 404
                status_text = "Not Found"
                payload = {"status": "not_found"}
            elif await self._database_healthy():
                status_code = 200
                status_text = "OK"
                payload = {"status": "ok", "database": "ok"}
            else:
                status_code = 503
                status_text = "Service Unavailable"
                payload = {"status": "unavailable", "database": "unavailable"}
        except (TimeoutError, UnicodeError, ValueError):
            status_code = 400
            status_text = "Bad Request"
            payload = {"status": "bad_request"}
        finally:
            body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
            writer.write(
                (
                    f"HTTP/1.1 {status_code} {status_text}\r\n"
                    "Content-Type: application/json\r\n"
                    f"Content-Length: {len(body)}\r\n"
                    "Connection: close\r\n"
                    "\r\n"
                ).encode("ascii")
                + body
            )
            with suppress(Exception):
                await writer.drain()
            writer.close()
            with suppress(Exception):
                await writer.wait_closed()

    @staticmethod
    async def _discard_headers(reader: asyncio.StreamReader) -> None:
        for _ in range(64):
            line = await asyncio.wait_for(reader.readline(), timeout=2.0)
            if line in {b"\r\n", b"\n", b""}:
                return
        raise ValueError("Too many request headers")
