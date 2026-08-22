import json

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.image import ImageBatchItem, ImageGenerationRequest
from narrativex_worker.providers.vertex_image_batch import (
    _batch_fingerprint,
    _batch_status,
    _jsonl_payload,
    _split_gs_uri,
    should_use_vertex_image_batch,
)
from narrativex_worker.schema import (
    ImageAspectRatio,
    ImageQualityTier,
    ProviderOperationStatus,
)


def _request(fingerprint: str, prompt: str) -> ImageGenerationRequest:
    return ImageGenerationRequest(
        request_fingerprint=fingerprint,
        prompt=prompt,
        negative_prompt=None,
        aspect_ratio=ImageAspectRatio.RATIO_16_9,
        quality_tier=ImageQualityTier.STANDARD,
        provider_key="vertex",
        model_key="gemini-2.5-flash-image",
        location="global",
    )


def _items() -> tuple[ImageBatchItem, ...]:
    return (
        ImageBatchItem("beat-1", _request("a" * 64, "Scene one")),
        ImageBatchItem("beat-2", _request("b" * 64, "Scene two")),
    )


def test_batch_jsonl_contains_one_generate_content_request_per_line() -> None:
    payload = _jsonl_payload(_items()).decode("utf-8")
    lines = [json.loads(line) for line in payload.splitlines()]

    assert len(lines) == 2
    assert lines[0]["contents"][0]["parts"][0]["text"] == "Scene one"
    assert lines[0]["generationConfig"]["responseModalities"] == ["TEXT", "IMAGE"]
    assert lines[1]["contents"][0]["parts"][0]["text"] == "Scene two"


def test_batch_jsonl_supports_single_image_request() -> None:
    payload = _jsonl_payload((_items()[0],)).decode("utf-8")
    lines = [json.loads(line) for line in payload.splitlines()]

    assert len(lines) == 1
    assert lines[0]["contents"][0]["parts"][0]["text"] == "Scene one"


def test_batch_fingerprint_is_deterministic_and_order_sensitive() -> None:
    items = _items()

    assert _batch_fingerprint(items) == _batch_fingerprint(items)
    assert _batch_fingerprint(items) != _batch_fingerprint(tuple(reversed(items)))


def test_default_batch_mode_routes_even_single_image() -> None:
    settings = WorkerSettings()

    assert should_use_vertex_image_batch(settings, 1) is True
    assert should_use_vertex_image_batch(settings, 100) is True


def test_explicit_auto_mode_uses_threshold_when_requested() -> None:
    without_bucket = WorkerSettings(
        vertex_image_execution_mode="auto",
        vertex_image_batch_min_items=2,
    )
    with_bucket = WorkerSettings(
        vertex_image_execution_mode="auto",
        vertex_image_batch_min_items=2,
        vertex_image_batch_gcs_bucket="narrativex-vertex-staging",
    )

    assert should_use_vertex_image_batch(without_bucket, 20) is False
    assert should_use_vertex_image_batch(with_bucket, 1) is False
    assert should_use_vertex_image_batch(with_bucket, 2) is True


def test_online_mode_never_routes_to_batch() -> None:
    settings = WorkerSettings(
        vertex_image_execution_mode="online",
        vertex_image_batch_gcs_bucket="narrativex-vertex-staging",
    )

    assert should_use_vertex_image_batch(settings, 100) is False


def test_batch_job_states_map_to_durable_provider_states() -> None:
    assert _batch_status("JOB_STATE_PENDING") is ProviderOperationStatus.SUBMITTED
    assert _batch_status("JOB_STATE_RUNNING") is ProviderOperationStatus.RUNNING
    assert _batch_status("JOB_STATE_SUCCEEDED") is ProviderOperationStatus.COMPLETED
    assert _batch_status("JOB_STATE_FAILED") is ProviderOperationStatus.FAILED
    assert _batch_status("JOB_STATE_UNSPECIFIED") is ProviderOperationStatus.UNKNOWN


def test_gcs_uri_parser_preserves_nested_prefix() -> None:
    assert _split_gs_uri("gs://bucket-a/narrativex/image-batches/job/output") == (
        "bucket-a",
        "narrativex/image-batches/job/output",
    )
