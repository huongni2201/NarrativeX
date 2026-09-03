from narrativex_worker.providers.image import ImageGenerationRequest
from narrativex_worker.providers.vertex_image import (
    _endpoint,
    _moderation,
    _prediction,
    _request_body,
    _request_headers,
    _traffic_type,
    _usage,
)
from narrativex_worker.schema import ImageAspectRatio, ModerationDecision


def _request() -> ImageGenerationRequest:
    return ImageGenerationRequest(
        request_fingerprint="fingerprint",
        prompt="A cinematic mountain village at dawn",
        negative_prompt="text, watermark",
        aspect_ratio=ImageAspectRatio.RATIO_16_9,
        provider_key="vertex",
        model_key="gemini-2.5-flash-image",
        location="global",
    )


def test_global_endpoint_uses_generate_content() -> None:
    endpoint = _endpoint("project-123", "global", "gemini-2.5-flash-image")
    assert endpoint == (
        "https://aiplatform.googleapis.com/v1/projects/project-123/locations/global/"
        "publishers/google/models/gemini-2.5-flash-image:generateContent"
    )


def test_request_body_requests_text_and_image_with_authorized_aspect_ratio() -> None:
    body = _request_body(_request())
    assert body["generationConfig"] == {
        "responseModalities": ["TEXT", "IMAGE"],
        "candidateCount": 1,
        "imageConfig": {"aspectRatio": "16:9"},
    }
    prompt = body["contents"][0]["parts"][0]["text"]  # type: ignore[index]
    assert "A cinematic mountain village at dawn" in prompt
    assert "text, watermark" in prompt


def test_flex_headers_use_vertex_shared_flex_tier() -> None:
    headers = _request_headers("token-123", "flex")
    assert headers == {
        "Authorization": "Bearer token-123",
        "X-Vertex-AI-LLM-Request-Type": "shared",
        "X-Vertex-AI-LLM-Shared-Request-Type": "flex",
    }


def test_standard_headers_do_not_request_flex() -> None:
    assert _request_headers("token-123", "standard") == {"Authorization": "Bearer token-123"}


def test_prediction_reads_gemini_inline_data() -> None:
    encoded, mime_type = _prediction({"candidates": [{"content": {"parts": [{"text": "Here is the image."}, {"inlineData": {"mimeType": "image/png", "data": "YWJj"}}]}, "finishReason": "STOP"}]})
    assert encoded == "YWJj"
    assert mime_type == "image/png"


def test_moderation_blocks_provider_safety_finish_reason() -> None:
    assert _moderation({"candidates": [{"finishReason": "IMAGE_SAFETY"}]}) is ModerationDecision.BLOCK


def test_usage_keeps_vertex_token_counts_and_traffic_type() -> None:
    raw = {"usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 1290, "totalTokenCount": 1300, "trafficType": "ON_DEMAND_FLEX"}}
    assert _traffic_type(raw) == "ON_DEMAND_FLEX"
    assert _usage(raw) == {"promptTokenCount": 10, "candidatesTokenCount": 1290, "totalTokenCount": 1300, "trafficType": "ON_DEMAND_FLEX"}
