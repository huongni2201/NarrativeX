import asyncio

import pytest

from narrativex_worker.health import WorkerHealthServer


class _ProbeServer(WorkerHealthServer):
    def __init__(self, database_healthy: bool) -> None:
        super().__init__("postgresql://unused", 0)
        self.database_healthy = database_healthy

    async def _database_healthy(self) -> bool:
        return self.database_healthy


async def _http_probe(server: WorkerHealthServer, path: str = "/healthz") -> bytes:
    await server.start()
    assert server._server is not None
    sockets = server._server.sockets
    assert sockets
    port = sockets[0].getsockname()[1]
    reader, writer = await asyncio.open_connection("127.0.0.1", port)
    writer.write(f"GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n".encode())
    await writer.drain()
    response = await reader.read()
    writer.close()
    await writer.wait_closed()
    await server.close()
    return response


@pytest.mark.asyncio
async def test_health_endpoint_is_ready_when_database_round_trip_succeeds() -> None:
    response = await _http_probe(_ProbeServer(True))

    assert response.startswith(b"HTTP/1.1 200 OK")
    assert b'"status":"ok"' in response
    assert b'"database":"ok"' in response


@pytest.mark.asyncio
async def test_health_endpoint_is_unhealthy_when_database_is_unavailable() -> None:
    response = await _http_probe(_ProbeServer(False))

    assert response.startswith(b"HTTP/1.1 503 Service Unavailable")
    assert b'"database":"unavailable"' in response


@pytest.mark.asyncio
async def test_health_endpoint_rejects_unknown_path() -> None:
    response = await _http_probe(_ProbeServer(True), "/unknown")

    assert response.startswith(b"HTTP/1.1 404 Not Found")
