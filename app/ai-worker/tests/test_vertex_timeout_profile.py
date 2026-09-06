from unittest.mock import Mock, patch

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.vertex import VertexGeminiTransport


def test_vertex_timeout_uses_short_connect_write_pool_and_configurable_read() -> None:
    settings = WorkerSettings(
        provider_mode="vertex",
        vertex_project_id="test-project",
        vertex_model="gemini-2.5-flash",
        vertex_timeout_seconds=240,
    )
    credentials = Mock(valid=True, token="token")
    with patch(
        "narrativex_worker.providers.vertex.google.auth.default",
        return_value=(credentials, None),
    ):
        transport = VertexGeminiTransport(settings)

    timeout = transport._http_timeout()

    assert timeout.connect == 10.0
    assert timeout.write == 30.0
    assert timeout.read == 240.0
    assert timeout.pool == 10.0
