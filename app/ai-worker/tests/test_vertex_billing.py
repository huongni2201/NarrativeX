"""Regression coverage for Vertex usage-to-cost reconciliation."""

from decimal import Decimal
from unittest.mock import Mock, patch

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.vertex import VertexGeminiTransport, VertexProviderError


def transport() -> VertexGeminiTransport:
    settings = WorkerSettings(
        provider_mode="vertex",
        vertex_project_id="billing-test-project",
        vertex_model="gemini-2.5-flash",
        vertex_location="us-central1",
    )
    credentials = Mock(valid=True, token="test-token")
    with patch(
        "narrativex_worker.providers.vertex.google.auth.default",
        return_value=(credentials, None),
    ):
        return VertexGeminiTransport(settings)


def test_standard_usage_is_reconciled_from_prompt_cache_tool_and_output_tokens() -> None:
    billing = transport()._billing(
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

    assert billing.currency == "USD"
    assert billing.actual_cost == Decimal("0.000435000")
    assert billing.usage.prompt_tokens == 1000
    assert billing.usage.cached_input_tokens == 200
    assert billing.pricing.pricing_mode == "STANDARD"
    assert billing.pricing.output_usd_per_million == Decimal("0.60")


def test_thinking_usage_prices_response_and_reasoning_at_thinking_rate() -> None:
    billing = transport()._billing(
        {
            "usageMetadata": {
                "promptTokenCount": 1000,
                "candidatesTokenCount": 500,
                "thoughtsTokenCount": 100,
                "totalTokenCount": 1600,
            }
        }
    )

    assert billing.actual_cost == Decimal("0.002250000")
    assert billing.pricing.pricing_mode == "STANDARD_THINKING"
    assert billing.pricing.output_usd_per_million == Decimal("3.50")


def test_non_billable_response_has_zero_cost_evidence() -> None:
    billing = transport()._zero_billing()

    assert billing.actual_cost == Decimal("0.000000000")
    assert billing.pricing.pricing_mode == "NOT_CHARGED_NON_200"


def test_unsupported_vertex_model_fails_closed_instead_of_guessing_price() -> None:
    settings = WorkerSettings(
        provider_mode="vertex",
        vertex_project_id="billing-test-project",
        vertex_model="gemini-unknown",
    )

    with pytest.raises(VertexProviderError, match="unsupported model"):
        VertexGeminiTransport(settings)
