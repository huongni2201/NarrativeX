"""Discounted Vertex batch inference adapter for Gemini image generation.

Batch inference is an asynchronous paid provider operation. Callers must persist their provider
reservation/submission fence before invoking ``submit_batch`` and persist the returned provider job
name before releasing the durable lease. GCS is staging only; final media remains in NarrativeX's
R2-backed media store.
"""

import base64
import hashlib
import json
from collections import defaultdict, deque
from collections.abc import Sequence
from urllib.parse import quote

import httpx

from narrativex_worker.config import WorkerSettings
from narrativex_worker.media_validation import MediaValidationError, validate_image_bytes
from narrativex_worker.providers.image import (
    ImageBatchItem,
    ImageBatchItemResult,
    ImageBatchOperation,
    ImageGenerationRequest,
    ImageGenerationResult,
)
from narrativex_worker.providers.ports import ProviderCapabilities
from narrativex_worker.providers.vertex_image import (
    VertexImageProvider,
    VertexImageProviderError,
    VertexImageSubmissionUnknownError,
    _finish_reason,
    _moderation,
    _prediction,
    _request_body,
    _usage,
)
from narrativex_worker.schema import ProviderOperationStatus


_TERMINAL_BATCH_STATES = {
    "JOB_STATE_SUCCEEDED",
    "JOB_STATE_FAILED",
    "JOB_STATE_CANCELLED",
    "JOB_STATE_PAUSED",
    "JOB_STATE_EXPIRED",
}


class VertexBatchImageProvider(VertexImageProvider):
    """Vertex Gemini image provider with online and discounted batch execution paths."""

    def __init__(self, settings: WorkerSettings) -> None:
        super().__init__(settings)

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            "vertex",
            supports_story_analysis=False,
            supports_image_generation=True,
            supports_operation_reconciliation=True,
        )

    async def submit_batch(self, items: Sequence[ImageBatchItem]) -> ImageBatchOperation:
        batch_items = tuple(items)
        if len(batch_items) < 2:
            raise VertexImageProviderError("Vertex image batch requires at least two items")
        bucket = _required_bucket(self.settings)
        model_key = _single_model(batch_items)
        batch_location = self.settings.vertex_image_batch_location
        token = await self._access_token()

        batch_fingerprint = _batch_fingerprint(batch_items)
        root = f"{self.settings.normalized_vertex_image_batch_prefix}/{batch_fingerprint}"
        input_object = f"{root}/requests.jsonl"
        input_uri = f"gs://{bucket}/{input_object}"
        output_uri = f"gs://{bucket}/{root}/output"
        payload = _jsonl_payload(batch_items)

        await self._upload_gcs_object(token, bucket, input_object, payload)

        endpoint = (
            f"{_vertex_base_url(batch_location)}/v1/projects/{self.settings.vertex_project_id}/"
            f"locations/{batch_location}/batchPredictionJobs"
        )
        body: dict[str, object] = {
            "displayName": f"narrativex-image-{batch_fingerprint[:24]}",
            "model": f"publishers/google/models/{model_key}",
            "inputConfig": {
                "instancesFormat": "jsonl",
                "gcsSource": {"uris": [input_uri]},
            },
            "outputConfig": {
                "predictionsFormat": "jsonl",
                "gcsDestination": {"outputUriPrefix": output_uri},
            },
        }
        try:
            async with httpx.AsyncClient(
                timeout=self.settings.vertex_image_batch_http_timeout_seconds
            ) as client:
                response = await client.post(endpoint, headers=_auth_headers(token), json=body)
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise VertexImageSubmissionUnknownError(
                "Vertex image batch submission outcome is unknown"
            ) from exception

        raw = _response_json(response)
        if response.status_code >= 500:
            raise VertexImageSubmissionUnknownError(
                f"Vertex image batch returned HTTP {response.status_code} during submission"
            )
        if response.is_error:
            return ImageBatchOperation(
                provider_key="vertex",
                operation_id=None,
                status=ProviderOperationStatus.FAILED,
                items=batch_items,
                input_uri=input_uri,
                output_uri=output_uri,
                error_code=f"HTTP_{response.status_code}",
                error_detail=_provider_error(raw),
            )

        operation_id = raw.get("name")
        if not isinstance(operation_id, str) or not operation_id:
            raise VertexImageSubmissionUnknownError(
                "Vertex accepted image batch submission without a durable job name"
            )
        return ImageBatchOperation(
            provider_key="vertex",
            operation_id=operation_id,
            status=_batch_status(raw.get("state")),
            items=batch_items,
            input_uri=input_uri,
            output_uri=output_uri,
        )

    async def reconcile_batch(self, operation: ImageBatchOperation) -> ImageBatchOperation:
        if operation.provider_key != "vertex":
            raise VertexImageProviderError(
                f"Cannot reconcile image batch owned by provider {operation.provider_key!r}"
            )
        if operation.status in {ProviderOperationStatus.COMPLETED, ProviderOperationStatus.FAILED}:
            return operation
        if not operation.operation_id:
            raise VertexImageProviderError("Cannot reconcile image batch without operation id")

        token = await self._access_token()
        endpoint = f"{_vertex_base_url(self.settings.vertex_image_batch_location)}/v1/{operation.operation_id}"
        try:
            async with httpx.AsyncClient(
                timeout=self.settings.vertex_image_batch_http_timeout_seconds
            ) as client:
                response = await client.get(endpoint, headers=_auth_headers(token))
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise VertexImageSubmissionUnknownError(
                "Vertex image batch reconciliation outcome is unknown"
            ) from exception

        raw = _response_json(response)
        if response.status_code >= 500:
            raise VertexImageSubmissionUnknownError(
                f"Vertex image batch reconciliation returned HTTP {response.status_code}"
            )
        if response.is_error:
            return ImageBatchOperation(
                provider_key=operation.provider_key,
                operation_id=operation.operation_id,
                status=ProviderOperationStatus.UNKNOWN,
                items=operation.items,
                input_uri=operation.input_uri,
                output_uri=operation.output_uri,
                error_code=f"HTTP_{response.status_code}",
                error_detail=_provider_error(raw),
            )

        state_value = raw.get("state")
        state = state_value if isinstance(state_value, str) else "JOB_STATE_UNSPECIFIED"
        status = _batch_status(state)
        actual_output = _batch_output_uri(raw) or operation.output_uri
        if state == "JOB_STATE_SUCCEEDED":
            if not actual_output:
                return ImageBatchOperation(
                    provider_key=operation.provider_key,
                    operation_id=operation.operation_id,
                    status=ProviderOperationStatus.UNKNOWN,
                    items=operation.items,
                    input_uri=operation.input_uri,
                    output_uri=operation.output_uri,
                    error_code="BATCH_OUTPUT_URI_MISSING",
                )
            results = await self._load_batch_results(token, actual_output, operation.items)
            return ImageBatchOperation(
                provider_key=operation.provider_key,
                operation_id=operation.operation_id,
                status=ProviderOperationStatus.COMPLETED,
                items=operation.items,
                input_uri=operation.input_uri,
                output_uri=actual_output,
                results=results,
            )
        if state in _TERMINAL_BATCH_STATES:
            return ImageBatchOperation(
                provider_key=operation.provider_key,
                operation_id=operation.operation_id,
                status=ProviderOperationStatus.FAILED,
                items=operation.items,
                input_uri=operation.input_uri,
                output_uri=actual_output,
                error_code=state,
                error_detail=_provider_error(raw),
            )
        return ImageBatchOperation(
            provider_key=operation.provider_key,
            operation_id=operation.operation_id,
            status=status,
            items=operation.items,
            input_uri=operation.input_uri,
            output_uri=actual_output,
        )

    async def _upload_gcs_object(
        self, token: str, bucket: str, object_name: str, content: bytes
    ) -> None:
        endpoint = f"https://storage.googleapis.com/upload/storage/v1/b/{quote(bucket, safe='')}/o"
        params = {"uploadType": "media", "name": object_name}
        try:
            async with httpx.AsyncClient(
                timeout=self.settings.vertex_image_batch_http_timeout_seconds
            ) as client:
                response = await client.post(
                    endpoint,
                    params=params,
                    headers={**_auth_headers(token), "Content-Type": "application/jsonl"},
                    content=content,
                )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise VertexImageSubmissionUnknownError(
                "GCS image batch staging upload outcome is unknown"
            ) from exception
        if response.status_code >= 500:
            raise VertexImageSubmissionUnknownError(
                f"GCS image batch staging returned HTTP {response.status_code}"
            )
        if response.is_error:
            raise VertexImageProviderError(
                f"GCS image batch staging failed with HTTP {response.status_code}"
            )

    async def _load_batch_results(
        self,
        token: str,
        output_uri: str,
        items: tuple[ImageBatchItem, ...],
    ) -> tuple[ImageBatchItemResult, ...]:
        bucket, prefix = _split_gs_uri(output_uri)
        object_names = await self._list_gcs_objects(token, bucket, prefix)
        result_objects = [
            name
            for name in object_names
            if name.endswith(".jsonl") and "error" not in name.lower()
        ]
        if not result_objects:
            return tuple(
                ImageBatchItemResult(
                    item.item_key,
                    item.request.request_fingerprint,
                    error_code="BATCH_OUTPUT_MISSING",
                )
                for item in items
            )

        rows: list[dict[str, object]] = []
        for object_name in sorted(result_objects):
            content = await self._download_gcs_object(token, bucket, object_name)
            for raw_line in content.splitlines():
                if not raw_line.strip():
                    continue
                try:
                    row = json.loads(raw_line)
                except json.JSONDecodeError:
                    continue
                if isinstance(row, dict):
                    rows.append(row)
        return _materialize_batch_rows(rows, items)

    async def _list_gcs_objects(self, token: str, bucket: str, prefix: str) -> list[str]:
        endpoint = f"https://storage.googleapis.com/storage/v1/b/{quote(bucket, safe='')}/o"
        object_names: list[str] = []
        page_token: str | None = None
        async with httpx.AsyncClient(
            timeout=self.settings.vertex_image_batch_http_timeout_seconds
        ) as client:
            while True:
                params: dict[str, str] = {"prefix": prefix.strip("/")}
                if page_token:
                    params["pageToken"] = page_token
                response = await client.get(endpoint, params=params, headers=_auth_headers(token))
                if response.is_error:
                    raise VertexImageProviderError(
                        f"GCS image batch result listing failed with HTTP {response.status_code}"
                    )
                raw = _response_json(response)
                values = raw.get("items")
                if isinstance(values, list):
                    for value in values:
                        if isinstance(value, dict) and isinstance(value.get("name"), str):
                            object_names.append(value["name"])
                next_page = raw.get("nextPageToken")
                if not isinstance(next_page, str) or not next_page:
                    break
                page_token = next_page
        return object_names

    async def _download_gcs_object(self, token: str, bucket: str, object_name: str) -> bytes:
        endpoint = (
            f"https://storage.googleapis.com/download/storage/v1/b/{quote(bucket, safe='')}/o/"
            f"{quote(object_name, safe='')}"
        )
        async with httpx.AsyncClient(
            timeout=self.settings.vertex_image_batch_http_timeout_seconds
        ) as client:
            response = await client.get(
                endpoint, params={"alt": "media"}, headers=_auth_headers(token)
            )
        if response.is_error:
            raise VertexImageProviderError(
                f"GCS image batch result download failed with HTTP {response.status_code}"
            )
        return response.content


def should_use_vertex_image_batch(settings: WorkerSettings, item_count: int) -> bool:
    """Return whether a non-interactive image set should use discounted batch inference."""

    if settings.vertex_image_execution_mode == "online":
        return False
    if settings.vertex_image_execution_mode == "batch":
        return True
    return bool(
        settings.vertex_image_batch_gcs_bucket
        and item_count >= settings.vertex_image_batch_min_items
    )


def _jsonl_payload(items: tuple[ImageBatchItem, ...]) -> bytes:
    lines = [
        json.dumps(_request_body(item.request), separators=(",", ":"), ensure_ascii=False)
        for item in items
    ]
    return ("\n".join(lines) + "\n").encode("utf-8")


def _batch_fingerprint(items: tuple[ImageBatchItem, ...]) -> str:
    digest = hashlib.sha256()
    for item in items:
        digest.update(item.item_key.encode("utf-8"))
        digest.update(b"\0")
        digest.update(item.request.request_fingerprint.encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def _single_model(items: tuple[ImageBatchItem, ...]) -> str:
    models = {item.request.model_key for item in items}
    if len(models) != 1:
        raise VertexImageProviderError("One Vertex image batch must use exactly one model")
    return next(iter(models))


def _materialize_batch_rows(
    rows: list[dict[str, object]], items: tuple[ImageBatchItem, ...]
) -> tuple[ImageBatchItemResult, ...]:
    by_instance: dict[str, deque[ImageBatchItem]] = defaultdict(deque)
    for item in items:
        by_instance[_canonical_json(_request_body(item.request))].append(item)

    remaining = deque(items)
    used_keys: set[str] = set()
    results: list[ImageBatchItemResult] = []

    for row in rows:
        item = _match_row_item(row, by_instance, remaining, used_keys)
        if item is None:
            continue
        used_keys.add(item.item_key)
        response = _prediction_response(row)
        if response is None:
            results.append(
                ImageBatchItemResult(
                    item.item_key,
                    item.request.request_fingerprint,
                    error_code=_row_error_code(row) or "INVALID_BATCH_PROVIDER_RESPONSE",
                    error_detail=_row_error_detail(row),
                )
            )
            continue
        results.append(_materialize_batch_result(item, response))

    for item in items:
        if item.item_key not in used_keys:
            results.append(
                ImageBatchItemResult(
                    item.item_key,
                    item.request.request_fingerprint,
                    error_code="BATCH_ITEM_RESULT_MISSING",
                )
            )
    return tuple(results)


def _match_row_item(
    row: dict[str, object],
    by_instance: dict[str, deque[ImageBatchItem]],
    remaining: deque[ImageBatchItem],
    used_keys: set[str],
) -> ImageBatchItem | None:
    instance = row.get("instance")
    if isinstance(instance, dict):
        candidates = by_instance.get(_canonical_json(instance))
        while candidates:
            matched = candidates.popleft()
            if matched.item_key not in used_keys:
                return matched
    while remaining:
        matched = remaining.popleft()
        if matched.item_key not in used_keys:
            return matched
    return None


def _materialize_batch_result(
    item: ImageBatchItem, raw: dict[str, object]
) -> ImageBatchItemResult:
    encoded, mime_type = _prediction(raw)
    if encoded is None:
        moderation = _moderation(raw)
        return ImageBatchItemResult(
            item.item_key,
            item.request.request_fingerprint,
            error_code=(
                "PROVIDER_REJECTED"
                if moderation.value == "BLOCK"
                else "INVALID_PROVIDER_RESPONSE"
            ),
        )
    try:
        content = base64.b64decode(encoded, validate=True)
        validated = validate_image_bytes(
            content,
            declared_mime_type=mime_type,
            aspect_ratio=item.request.aspect_ratio,
            max_bytes=item.request.max_output_bytes,
        )
    except (ValueError, MediaValidationError):
        return ImageBatchItemResult(
            item.item_key,
            item.request.request_fingerprint,
            error_code="INVALID_IMAGE_OUTPUT",
        )
    result = ImageGenerationResult(
        mime_type=validated.mime_type,
        content=content,
        width=validated.width,
        height=validated.height,
        moderation=_moderation(raw),
        result_fingerprint=validated.sha256,
        provider_metadata={
            "model": item.request.model_key,
            "finishReason": _finish_reason(raw) or "UNKNOWN",
            "executionMode": "batch",
        },
        usage=_usage(raw),
        actual_cost=None,
    )
    return ImageBatchItemResult(
        item.item_key,
        item.request.request_fingerprint,
        result=result,
    )


def _prediction_response(row: dict[str, object]) -> dict[str, object] | None:
    for key in ("prediction", "response"):
        value = row.get(key)
        if isinstance(value, dict):
            return value
    if isinstance(row.get("candidates"), list):
        return row
    return None


def _row_error_code(row: dict[str, object]) -> str | None:
    status = row.get("status")
    if isinstance(status, dict):
        code = status.get("code")
        if isinstance(code, int | str):
            return f"BATCH_ITEM_{code}"
    return None


def _row_error_detail(row: dict[str, object]) -> str | None:
    status = row.get("status")
    if isinstance(status, dict) and isinstance(status.get("message"), str):
        return status["message"][:1000]
    return None


def _batch_status(value: object) -> ProviderOperationStatus:
    state = value if isinstance(value, str) else "JOB_STATE_UNSPECIFIED"
    if state == "JOB_STATE_SUCCEEDED":
        return ProviderOperationStatus.COMPLETED
    if state in _TERMINAL_BATCH_STATES:
        return ProviderOperationStatus.FAILED
    if state in {"JOB_STATE_RUNNING", "JOB_STATE_CANCELLING"}:
        return ProviderOperationStatus.RUNNING
    if state in {"JOB_STATE_PENDING", "JOB_STATE_QUEUED"}:
        return ProviderOperationStatus.SUBMITTED
    return ProviderOperationStatus.UNKNOWN


def _batch_output_uri(raw: dict[str, object]) -> str | None:
    output_info = raw.get("outputInfo")
    if isinstance(output_info, dict):
        value = output_info.get("gcsOutputDirectory")
        if isinstance(value, str) and value:
            return value
    output_config = raw.get("outputConfig")
    if isinstance(output_config, dict):
        destination = output_config.get("gcsDestination")
        if isinstance(destination, dict):
            value = destination.get("outputUriPrefix")
            if isinstance(value, str) and value:
                return value
    return None


def _split_gs_uri(uri: str) -> tuple[str, str]:
    if not uri.startswith("gs://"):
        raise VertexImageProviderError(f"Expected gs:// URI, got {uri!r}")
    path = uri[5:]
    bucket, separator, prefix = path.partition("/")
    if not bucket or not separator:
        raise VertexImageProviderError(f"GCS URI must include object prefix: {uri!r}")
    return bucket, prefix.strip("/")


def _required_bucket(settings: WorkerSettings) -> str:
    value = settings.vertex_image_batch_gcs_bucket
    if not value or not value.strip():
        raise VertexImageProviderError(
            "VERTEX_IMAGE_BATCH_GCS_BUCKET is required for Vertex image batch inference"
        )
    return value.strip()


def _vertex_base_url(location: str) -> str:
    return (
        "https://aiplatform.googleapis.com"
        if location == "global"
        else f"https://{location}-aiplatform.googleapis.com"
    )


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _canonical_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _response_json(response: httpx.Response) -> dict[str, object]:
    try:
        value = response.json()
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def _provider_error(raw: dict[str, object]) -> str | None:
    error = raw.get("error")
    if isinstance(error, dict) and isinstance(error.get("message"), str):
        return error["message"][:1000]
    value = raw.get("errorMessage")
    return value[:1000] if isinstance(value, str) else None
