"""Regression coverage for Vertex usage telemetry with monetary billing disabled."""

from decimal import Decimal
from unittest.mock import Mock, patch

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.vertex import VertexGeminiTransport


def transport(model: str = "gemini-2.5-flash") -> VertexGeminiTransport:
    settings = WorkerSettings(
        provider_mode="vertex",
        vertex_project_id="billing-test-project",
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
    usage = transport()._usage_envelope(
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

    assert usage.actual_cost == Decimal("0.000000000")
    assert usage.usage.prompt_tokens == 1000
    assert usage.usage.cached_input_tokens == 200
    assert usage.usage.tool_input_tokens == 50
    assert usage.usage.candidate_tokens == 500
    assert usage.usage.total_tokens == 1550
    assert usage.pricing.catalog_version == "billing-disabled"
    assert usage.pricing.pricing_mode == "USAGE_ONLY"
    assert usage.pricing.input_usd_per_million == Decimal("0")
    assert usage.pricing.output_usd_per_million == Decimal("0")


def test_thinking_usage_is_not_assigned_a_price() -> None:
    usage = transport()._usage_envelope(
        {
            "usageMetadata": {
                "promptTokenCount": 1000,
                "candidatesTokenCount": 500,
                "thoughtsTokenCount": 100,
                "totalTokenCount": 1600,
            }
        }
    )

    assert usage.actual_cost == Decimal("0.000000000")
    assert usage.usage.thought_tokens == 100
    assert usage.pricing.pricing_mode == "USAGE_ONLY"
    assert usage.pricing.output_usd_per_million == Decimal("0")


def test_response_without_usage_has_non_monetary_compatibility_envelope() -> None:
    usage = transport()._zero_billing()

    assert usage.actual_cost == Decimal("0.000000000")
    assert usage.pricing.catalog_version == "billing-disabled"
    assert usage.pricing.pricing_mode == "USAGE_UNAVAILABLE"


def test_vertex_model_support_is_not_limited_by_a_pricing_catalog() -> None:
    adapter = transport("gemini-unknown")

    assert adapter.settings.vertex_model == "gemini-unknown"
