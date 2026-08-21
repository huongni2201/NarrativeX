"""Vertex Imagen adapter using the provider-neutral image port."""

import asyncio
import base64
from decimal import Decimal

import google.auth
import httpx
from google.auth.credentials import Credentials
from google.auth.transport.requests import Request

from narrativex_worker.config import WorkerSettings
from narrativex_worker.media_validation import (
    MediaValidationError,
    normalize_moderation,
    validate_image_bytes,
)
from narrativex_worker.providers.image import (
    ImageGenerationProvider,
    ImageGenerationRequest,
    ImageGenerationResult,
    ImageProviderOperation,
)
from narrativex_worker.providers.ports import ProviderCapabilities
from narrativex_worker.schema import ProviderOperationStatus


class VertexImageProviderError(RuntimeError):
    pass


class VertexImageSubmissionUnknownError(VertexImageProviderError):
    pass


class VertexImageProvider(ImageGenerationProvider):
    def __init__(self, settings: WorkerSettings) -> None:
        if not settings.vertex_project_id:
            raise VertexImageProviderError(
                "VERTEX_PROJECT_ID is required when image provider is enabled"
            )
        self.settings = settings
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        self._credentials: Credentials = credentials

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            "vertex",
            supports_story_analysis=False,
            supports_image_generation=True,
            supports_operation_reconciliation=False,
        )

    async def submit(self, request: ImageGenerationRequest) -> ImageProviderOperation:
        token = await self._access_token()
        endpoint = f"https://{request.location}-aiplatform.googleapis.com/v1/projects/{self.settings.vertex_project_id}/locations/{request.location}/publishers/google/models/{request.model_key}:predict"
        body: dict[str, object] = {
            "instances": [{"prompt": request.prompt}],
            "parameters": {"sampleCount": 1, "aspectRatio": request.aspect_ratio.value},
        }
        if request.negative_prompt:
            body["instances"] = [
                {"prompt": request.prompt, "negativePrompt": request.negative_prompt}
            ]
        try:
            async with httpx.AsyncClient(
                timeout=self.settings.vertex_image_timeout_seconds
            ) as client:
                response = await client.post(
                    endpoint, headers={"Authorization": f"Bearer {token}"}, json=body
                )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise VertexImageSubmissionUnknownError(
                "Vertex image submission outcome is unknown"
            ) from exception
        raw = _response_json(response)
        operation_id = _string(raw.get("deployedModelId"))
        if response.status_code >= 500:
            raise VertexImageSubmissionUnknownError(
                f"Vertex image returned HTTP {response.status_code}"
            )
        if response.is_error:
            return ImageProviderOperation(
                "vertex",
                operation_id,
                ProviderOperationStatus.FAILED,
                error_code=f"HTTP_{response.status_code}",
            )
        encoded, mime_type = _prediction(raw)
        if encoded is None:
            return ImageProviderOperation(
                "vertex",
                operation_id,
                ProviderOperationStatus.FAILED,
                error_code="INVALID_PROVIDER_RESPONSE",
            )
        try:
            content = base64.b64decode(encoded, validate=True)
            validated = validate_image_bytes(
                content,
                declared_mime_type=mime_type,
                aspect_ratio=request.aspect_ratio,
                max_bytes=request.max_output_bytes,
            )
        except (ValueError, MediaValidationError):
            return ImageProviderOperation(
                "vertex",
                operation_id,
                ProviderOperationStatus.FAILED,
                error_code="INVALID_IMAGE_OUTPUT",
            )
        result = ImageGenerationResult(
            validated.mime_type,
            content,
            validated.width,
            validated.height,
            normalize_moderation(raw.get("safety")),
            validated.sha256,
            {"model": request.model_key},
            {},
            Decimal("0"),
        )
        return ImageProviderOperation(
            "vertex", operation_id, ProviderOperationStatus.COMPLETED, result=result
        )

    async def reconcile(self, operation: ImageProviderOperation) -> ImageProviderOperation:
        return operation

    async def _access_token(self) -> str:
        if (
            self._credentials.valid
            and isinstance(self._credentials.token, str)
            and self._credentials.token
        ):
            return self._credentials.token
        await asyncio.to_thread(self._credentials.refresh, Request())
        if not isinstance(self._credentials.token, str) or not self._credentials.token:
            raise VertexImageProviderError("ADC returned an empty access token")
        return self._credentials.token


def _response_json(response: httpx.Response) -> dict[str, object]:
    try:
        value = response.json()
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def _prediction(raw: dict[str, object]) -> tuple[str | None, str | None]:
    predictions = raw.get("predictions")
    if not isinstance(predictions, list) or not predictions or not isinstance(predictions[0], dict):
        return None, None
    item = predictions[0]
    encoded = item.get("bytesBase64Encoded")
    mime = item.get("mimeType", "image/png")
    return (encoded if isinstance(encoded, str) else None, mime if isinstance(mime, str) else None)


def _string(value: object) -> str | None:
    return value if isinstance(value, str) and value else None
