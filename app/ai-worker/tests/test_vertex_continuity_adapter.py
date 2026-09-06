import inspect
from unittest.mock import Mock, patch

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.vertex import VertexGeminiTransport
from narrativex_worker.providers.vertex_continuity import (
    ContinuityVertexGeminiProvider,
    _VertexStructuredAdapter,
)


def _settings() -> WorkerSettings:
    return WorkerSettings(
        provider_mode="vertex",
        vertex_project_id="test-project",
        vertex_model="gemini-2.5-flash",
    )


def _transport() -> VertexGeminiTransport:
    credentials = Mock(valid=True, token="token")
    with patch(
        "narrativex_worker.providers.vertex.google.auth.default",
        return_value=(credentials, None),
    ):
        return VertexGeminiTransport(_settings())


def _provider() -> ContinuityVertexGeminiProvider:
    credentials = Mock(valid=True, token="token")
    with patch(
        "narrativex_worker.providers.vertex.google.auth.default",
        return_value=(credentials, None),
    ):
        return ContinuityVertexGeminiProvider(_settings())


def test_vertex_structured_adapter_accepts_keyword_only_identity() -> None:
    parameters = inspect.signature(_VertexStructuredAdapter.generate).parameters

    assert "identity" in parameters
    assert parameters["identity"].kind is inspect.Parameter.KEYWORD_ONLY
    assert parameters["identity"].default is None


def test_vertex_transport_does_not_expose_provider_submit() -> None:
    assert not hasattr(_transport(), "submit")


def test_continuity_provider_owns_story_analysis_capability() -> None:
    capabilities = _provider().get_capabilities()

    assert capabilities.provider_key == "vertex"
    assert capabilities.supports_story_analysis is True


def test_vertex_diagnostic_does_not_include_exception_message() -> None:
    reason = VertexGeminiTransport._safe_exception_reason(
        ValueError("SECRET_STORY_FRAGMENT must not enter logs")
    )

    assert reason == "ValueError"
    assert "SECRET_STORY_FRAGMENT" not in reason
