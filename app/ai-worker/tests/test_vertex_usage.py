"""Regression coverage for non-monetary Vertex usage telemetry."""

from unittest.mock import Mock, patch

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.vertex import VertexGeminiTransport


def transport(model: str = "gemini-2.5-flash") -> VertexGeminiTransport:
    settings = WorkerSettings(
        provider_mode="vertex",
        vertex_project_id="usage-test-project",
        vertex_model=model,
        vertex_location="us-central1",
    )
    credentials = Mock(valid=True, token="test-token")
    with patch(
        "narrativex_worker.providers.vertex.google.auth.default",
        return_value=(credentials, None),
    ):
        return VertexGeminiTransport(settings)


def test_standard_usage_is_kept_as_non_monetary_telemetry() -> None:
    usage = transport()._usage(
        {
            "usageMetadata": {
                "promptTokenCount": 1000,
                "cachedContentTokenCount": 200,
                "toolUsePromptTokenCount": 50,
                "candidatesTokenCount": 500,
                "totalTokenCount": 1550,
            }
        }
    )

    assert usage.prompt_tokens == 1000
    assert usage.cached_input_tokens == 200
    assert usage.tool_input_tokens == 50
    assert usage.candidate_tokens == 500
    assert usage.total_tokens == 1550


def test_thinking_usage_is_preserved_without_pricing() -> None:
    usage = transport()._usage(
        {
            "usageMetadata": {
                "promptTokenCount": 1000,
                "candidatesTokenCount": 500,
                "thoughtsTokenCount": 100,
                "totalTokenCount": 1600,
            }
        }
    )

    assert usage.thought_tokens == 100


def test_response_without_usage_returns_zero_usage() -> None:
    usage = transport()._usage({})

    assert usage.prompt_tokens == 0
    assert usage.candidate_tokens == 0


def test_vertex_model_support_is_not_limited_by_a_pricing_catalog() -> None:
    adapter = transport("gemini-unknown")

    assert adapter.settings.vertex_model == "gemini-unknown"
