"""Reference-aware Vertex batch adapter for Gemini image generation.

Character references remain private NarrativeX media assets in R2. Immediately before the paid
Vertex batch boundary, this adapter verifies each immutable reference checksum, stages it to a
content-addressed GCS object, and builds the exact multimodal request that can later be reconstructed
for provider-output correlation and crash recovery.
"""

import hashlib
import json
from collections import defaultdict, deque
from collections.abc import Sequence
from urllib.parse import quote

import httpx

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.image import (
    ImageBatchItem,
    ImageBatchItemResult,
    ImageBatchOperation,
    ImageReference,
    ReferenceObjectStore,
)
from narrativex_worker.providers.vertex_image import (
    VertexImageProviderError,
    VertexImageSubmissionUnknownError,
    _request_body,
)
from narrativex_worker.providers.vertex_image_batch import (
    BatchItemCorrelationError,
    VertexBatchImageProvider,
    _auth_headers,
    _batch_fingerprint,
    _batch_status,
    _canonical_json,
    _materialize_batch_result,
    _prediction_response,
    _provider_error,
    _required_bucket,
    _response_json,
    _row_error_code,
    _row_error_detail,
    _single_model,
    _split_gs_uri,
    _vertex_base_url,
    batch_display_name,
)
from narrativex_worker.schema import ProviderOperationStatus


class ReferenceAwareVertexBatchImageProvider(VertexBatchImageProvider):
    """Vertex batch provider that can consume immutable character reference images."""

    def __init__(
        self,
        settings: WorkerSettings,
        reference_store: ReferenceObjectStore | None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        super().__init__(settings, client=client)
        self.reference_store = reference_store

    async def submit_batch(self, items: Sequence[ImageBatchItem]) -> ImageBatchOperation:
        batch_items = tuple(items)
        if not batch_items:
            raise VertexImageProviderError("Vertex image batch requires at least one item")

        bucket = _required_bucket(self.settings)
        model_key = _single_model(batch_items)
        batch_location = self.settings.vertex_image_batch_location
        token = await self._access_token()

        await self._stage_references(token, bucket, batch_items)

        fingerprint = _batch_fingerprint(batch_items)
        root = f"{self.settings.normalized_vertex_image_batch_prefix}/{fingerprint}"
        input_object = f"{root}/requests.jsonl"
        input_uri = f"gs://{bucket}/{input_object}"
        output_uri = f"gs://{bucket}/{root}/output"
        payload = _jsonl_payload(batch_items, self.settings)

        await self._upload_gcs_object(token, bucket, input_object, payload)

        endpoint = (
            f"{_vertex_base_url(batch_location)}/v1/projects/{self.settings.vertex_project_id}/"
            f"locations/{batch_location}/batchPredictionJobs"
        )
        model_name = (
            f"projects/{self.settings.vertex_project_id}/locations/{batch_location}/"
            f"publishers/google/models/{model_key}"
        )
        body: dict[str, object] = {
            "displayName": batch_display_name(fingerprint),
            "model": model_name,
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
            async with self._client_context() as client:
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

    async def _stage_references(
        self, token: str, bucket: str, items: tuple[ImageBatchItem, ...]
    ) -> None:
        references = _unique_references(items)
        if not references:
            return
        if self.reference_store is None:
            raise VertexImageProviderError(
                "Character references require an immutable media reference store"
            )
        for reference in references:
            content = await self.reference_store.get_bytes(reference.storage_key)
            checksum = hashlib.sha256(content).hexdigest()
            if checksum != reference.sha256.lower():
                raise VertexImageProviderError(
                    f"REFERENCE_CHECKSUM_MISMATCH:{reference.asset_id}"
                )
            await self._put_reference_if_absent(token, bucket, reference, content)

    async def _put_reference_if_absent(
        self,
        token: str,
        bucket: str,
        reference: ImageReference,
        content: bytes,
    ) -> None:
        object_name = _reference_object_name(self.settings, reference)
        endpoint = f"https://storage.googleapis.com/upload/storage/v1/b/{quote(bucket, safe='')}/o"
        params = {
            "uploadType": "media",
            "name": object_name,
            "ifGenerationMatch": "0",
        }
        try:
            async with self._client_context() as client:
                response = await client.post(
                    endpoint,
                    params=params,
                    headers={**_auth_headers(token), "Content-Type": reference.mime_type},
                    content=content,
                )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise VertexImageSubmissionUnknownError(
                "GCS reference staging outcome is unknown"
            ) from exception

        if response.status_code == 412:
            existing = await self._download_gcs_object(token, bucket, object_name)
            if hashlib.sha256(existing).hexdigest() != reference.sha256.lower():
                raise VertexImageProviderError(
                    f"GCS_REFERENCE_CONTENT_CONFLICT:{reference.asset_id}"
                )
            return
        if response.status_code >= 500:
            raise VertexImageSubmissionUnknownError(
                f"GCS reference staging returned HTTP {response.status_code}"
            )
        if response.is_error:
            raise VertexImageProviderError(
                f"GCS reference staging failed with HTTP {response.status_code}"
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
            name for name in object_names if name.endswith(".jsonl") and "error" not in name.lower()
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
        return _materialize_reference_batch_rows(rows, items, self.settings)


def _unique_references(items: tuple[ImageBatchItem, ...]) -> tuple[ImageReference, ...]:
    by_asset: dict[str, ImageReference] = {}
    for item in items:
        if len(item.request.references) > 3:
            raise VertexImageProviderError("Gemini image requests support at most 3 references")
        for reference in item.request.references:
            existing = by_asset.get(reference.asset_id)
            if existing is not None and existing != reference:
                raise VertexImageProviderError(
                    f"REFERENCE_SNAPSHOT_CONFLICT:{reference.asset_id}"
                )
            by_asset[reference.asset_id] = reference
    return tuple(sorted(by_asset.values(), key=lambda value: value.asset_id))


def _reference_object_name(settings: WorkerSettings, reference: ImageReference) -> str:
    checksum = reference.sha256.lower()
    if len(checksum) != 64 or any(char not in "0123456789abcdef" for char in checksum):
        raise VertexImageProviderError(f"INVALID_REFERENCE_SHA256:{reference.asset_id}")
    return f"{settings.normalized_vertex_image_batch_prefix}/references/{checksum[:2]}/{checksum}"


def _reference_uri(settings: WorkerSettings, reference: ImageReference) -> str:
    return f"gs://{_required_bucket(settings)}/{_reference_object_name(settings, reference)}"


def _reference_request_body(item: ImageBatchItem, settings: WorkerSettings) -> dict[str, object]:
    uris = {reference.asset_id: _reference_uri(settings, reference) for reference in item.request.references}
    return _request_body(item.request, reference_uris=uris if uris else None)


def _jsonl_payload(items: tuple[ImageBatchItem, ...], settings: WorkerSettings) -> bytes:
    lines = [
        json.dumps(
            {"request": _reference_request_body(item, settings)},
            separators=(",", ":"),
            ensure_ascii=False,
        )
        for item in items
    ]
    return ("\n".join(lines) + "\n").encode("utf-8")


def _materialize_reference_batch_rows(
    rows: list[dict[str, object]],
    items: tuple[ImageBatchItem, ...],
    settings: WorkerSettings,
) -> tuple[ImageBatchItemResult, ...]:
    by_request: dict[str, deque[ImageBatchItem]] = defaultdict(deque)
    for item in items:
        request_json = _canonical_json(_reference_request_body(item, settings))
        by_request[request_json].append(item)
    if any(len(candidates) > 1 for candidates in by_request.values()):
        raise BatchItemCorrelationError("BATCH_ITEM_CORRELATION_FAILED: duplicate request bodies")

    used_keys: set[str] = set()
    results: list[ImageBatchItemResult] = []
    for row in rows:
        request = row.get("request")
        if not isinstance(request, dict):
            raise BatchItemCorrelationError("BATCH_ITEM_CORRELATION_FAILED")
        candidates = by_request.get(_canonical_json(request))
        if not candidates or len(candidates) != 1:
            raise BatchItemCorrelationError("BATCH_ITEM_CORRELATION_FAILED")
        item = candidates[0]
        if item.item_key in used_keys:
            raise BatchItemCorrelationError("BATCH_ITEM_CORRELATION_FAILED: duplicate output")
        used_keys.add(item.item_key)

        provider_response = _prediction_response(row)
        if provider_response is None:
            results.append(
                ImageBatchItemResult(
                    item.item_key,
                    item.request.request_fingerprint,
                    error_code=_row_error_code(row) or "INVALID_BATCH_PROVIDER_RESPONSE",
                    error_detail=_row_error_detail(row),
                )
            )
            continue
        results.append(_materialize_batch_result(item, provider_response))

    if len(results) != len(items) or len(used_keys) != len(items):
        raise BatchItemCorrelationError("BATCH_ITEM_CORRELATION_FAILED: cardinality mismatch")
    return tuple(results)
