import base64
import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from io import BytesIO
from typing import Any, cast

import httpx
import pytest
from PIL import Image

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.image import (
    ImageBatchItem,
    ImageBatchOperation,
    ImageGenerationRequest,
)
from narrativex_worker.providers.vertex_image_batch import (  # type: ignore[attr-defined]
    BatchItemCorrelationError,
    VertexBatchImageProvider,
    _batch_fingerprint,
    _batch_status,
    _jsonl_payload,
    _materialize_batch_rows,
    _request_body,
    _split_gs_uri,
)
from narrativex_worker.schema import ImageAspectRatio, ProviderOperationStatus


def _request(fingerprint: str, prompt: str) -> ImageGenerationRequest:
    return ImageGenerationRequest(
        request_fingerprint=fingerprint,
        prompt=prompt,
        negative_prompt=None,
        aspect_ratio=ImageAspectRatio.RATIO_16_9,
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
    assert lines[0]["request"]["contents"][0]["parts"][0]["text"] == "Scene one"
    assert lines[0]["request"]["generationConfig"]["responseModalities"] == ["TEXT", "IMAGE"]
    assert lines[1]["request"]["contents"][0]["parts"][0]["text"] == "Scene two"


def test_batch_jsonl_supports_single_image_request() -> None:
    payload = _jsonl_payload((_items()[0],)).decode("utf-8")
    lines = [json.loads(line) for line in payload.splitlines()]
    assert len(lines) == 1
    assert lines[0]["request"]["contents"][0]["parts"][0]["text"] == "Scene one"


def test_batch_fingerprint_is_deterministic_and_order_sensitive() -> None:
    items = _items()
    assert _batch_fingerprint(items) == _batch_fingerprint(items)
    assert _batch_fingerprint(items) != _batch_fingerprint(tuple(reversed(items)))


def test_batch_job_states_map_to_durable_provider_states() -> None:
    assert _batch_status("JOB_STATE_PENDING") is ProviderOperationStatus.SUBMITTED
    assert _batch_status("JOB_STATE_RUNNING") is ProviderOperationStatus.RUNNING
    assert _batch_status("JOB_STATE_SUCCEEDED") is ProviderOperationStatus.COMPLETED
    assert _batch_status("JOB_STATE_FAILED") is ProviderOperationStatus.FAILED
    assert _batch_status("JOB_STATE_UNSPECIFIED") is ProviderOperationStatus.UNKNOWN


class _ErrorClient:
    async def get(self, *args: object, **kwargs: object) -> httpx.Response:
        del args, kwargs
        return httpx.Response(
            404,
            json={"error": {"message": "batch not found"}},
            request=httpx.Request("GET", "https://example.test"),
        )


class _DownloadClient:
    async def get(self, *args: object, **kwargs: object) -> httpx.Response:
        del args, kwargs
        return httpx.Response(
            200, content=b"generated-output", request=httpx.Request("GET", "https://example.test")
        )


class _BatchOutputClient:
    def __init__(self, content: bytes) -> None:
        self.content = content

    async def get(self, endpoint: str, *args: object, **kwargs: object) -> httpx.Response:
        del args, kwargs
        if "/storage/v1/" in endpoint and "download/storage/v1" not in endpoint:
            return httpx.Response(
                200,
                json={"items": [{"name": "output/results.jsonl"}]},
                request=httpx.Request("GET", endpoint),
            )
        return httpx.Response(200, content=self.content, request=httpx.Request("GET", endpoint))


class _ReconcileProvider(VertexBatchImageProvider):
    def __init__(self) -> None:
        self._client: Any = _ErrorClient()
        self.settings = WorkerSettings(vertex_image_batch_gcs_bucket="bucket")
        self.logger = logging.getLogger("narrativex.vertex-image-batch")

    async def _access_token(self) -> str:
        return "token"

    @asynccontextmanager
    async def _client_context(self) -> AsyncIterator[httpx.AsyncClient]:
        yield cast(httpx.AsyncClient, self._client)


@pytest.mark.asyncio
async def test_reconcile_http_4xx_is_provider_failed() -> None:
    provider = _ReconcileProvider()
    operation = ImageBatchOperation(
        provider_key="vertex",
        operation_id="projects/p/locations/global/batchPredictionJobs/123",
        status=ProviderOperationStatus.RUNNING,
        items=_items(),
    )
    resolved = await provider.reconcile_batch(operation)
    assert resolved.status is ProviderOperationStatus.FAILED
    assert resolved.error_code == "HTTP_404"


@pytest.mark.asyncio
async def test_download_gcs_object_logs_successful_download(
    caplog: pytest.LogCaptureFixture,
) -> None:
    provider = _ReconcileProvider()
    provider._client = _DownloadClient()
    caplog.set_level(logging.INFO, logger="narrativex.vertex-image-batch")
    content = await provider._download_gcs_object("token", "bucket", "output/results.jsonl")
    assert content == b"generated-output"
    assert "Downloaded Vertex image batch result object" in caplog.text
    assert "bucket=bucket" in caplog.text
    assert "object=output/results.jsonl" in caplog.text
    assert "bytes=16" in caplog.text


def _valid_test_image() -> bytes:
    buffer = BytesIO()
    image = Image.new("RGB", (16, 9), color="red")
    image.save(buffer, format="PNG")
    image.close()
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_batch_output_logs_materialized_generated_image(
    caplog: pytest.LogCaptureFixture,
) -> None:
    image = _valid_test_image()
    encoded = base64.b64encode(image).decode("ascii")
    output = "\n".join(
        json.dumps(
            {
                "request": _request_body(item.request),
                "response": {
                    "candidates": [
                        {
                            "content": {
                                "parts": [
                                    {"inlineData": {"mimeType": "image/png", "data": encoded}}
                                ]
                            }
                        }
                    ]
                },
            }
        )
        for item in _items()
    ).encode("utf-8")
    provider = _ReconcileProvider()
    provider._client = _BatchOutputClient(output)
    caplog.set_level(logging.INFO, logger="narrativex.vertex-image-batch")
    results = await provider._load_batch_results("token", "gs://bucket/output", _items())
    assert all(result.result is not None for result in results)
    assert "Materialized Vertex generated image" in caplog.text
    assert "item=beat-1" in caplog.text
    assert f"bytes={len(image)}" in caplog.text


def test_gcs_uri_parser_preserves_nested_prefix() -> None:
    assert _split_gs_uri("gs://bucket-a/narrativex/image-batches/job/output") == (
        "bucket-a",
        "narrativex/image-batches/job/output",
    )


def test_batch_correlation_rejects_missing_request_instead_of_using_position() -> None:
    with pytest.raises(BatchItemCorrelationError, match="BATCH_ITEM_CORRELATION_FAILED"):
        _materialize_batch_rows([{"prediction": {}}], _items())


def test_batch_correlation_rejects_unknown_request_instead_of_using_position() -> None:
    with pytest.raises(BatchItemCorrelationError, match="BATCH_ITEM_CORRELATION_FAILED"):
        _materialize_batch_rows(
            [{"request": _request_body(_request("c" * 64, "Unknown"))}], _items()
        )


def test_batch_output_correlates_using_request_not_position() -> None:
    rows: list[dict[str, object]] = [
        {"request": _request_body(_items()[1].request), "response": {}},
        {"request": _request_body(_items()[0].request), "response": {}},
    ]
    results = _materialize_batch_rows(rows, _items())
    assert [result.item_key for result in results] == ["beat-2", "beat-1"]


def test_batch_output_reordered_rows_are_safe() -> None:
    items = _items()
    rows: list[dict[str, object]] = [
        {"request": _request_body(items[1].request), "response": {}},
        {"request": _request_body(items[0].request), "response": {}},
    ]
    results = _materialize_batch_rows(rows, items)
    assert [result.item_key for result in results] == ["beat-2", "beat-1"]


def test_batch_correlation_rejects_identical_request_bodies() -> None:
    duplicate = ImageBatchItem("beat-2", _request("b" * 64, "Scene one"))
    with pytest.raises(BatchItemCorrelationError, match="duplicate request bodies"):
        _materialize_batch_rows(
            [
                {"request": _request_body(_items()[0].request)},
                {"request": _request_body(duplicate.request)},
            ],
            (_items()[0], duplicate),
        )
