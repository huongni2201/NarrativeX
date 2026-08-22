"""Vertex Gemini image adapter using the provider-neutral image port."""

import asyncio
import base64

import google.auth
import httpx
from google.auth.credentials import Credentials
from google.auth.transport.requests import Request

from narrativex_worker.config import WorkerSettings
from narrativex_worker.media_validation import MediaValidationError, validate_image_bytes
from narrativex_worker.providers.image import (
    ImageGenerationProvider,
    ImageGenerationRequest,
    ImageGenerationResult,
    ImageProviderOperation,
)
from narrativex_worker.providers.ports import ProviderCapabilities
from narrativex_worker.schema import ModerationDecision, ProviderOperationStatus


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
        endpoint = _endpoint(
            self.settings.vertex_project_id,
            request.location,
            request.model_key,
        )
        body = _request_body(request)
        try:
            async with httpx.AsyncClient(
                timeout=self.settings.vertex_image_timeout_seconds
            ) as client:
                response = await client.post(
                    endpoint,
                    headers={"Authorization": f"Bearer {token}"},
                    json=body,
                )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise VertexImageSubmissionUnknownError(
                "Vertex image submission outcome is unknown"
            ) from exception

        raw = _response_json(response)
        response_id = _string(raw.get("responseId"))
        if response.status_code >= 500:
            raise VertexImageSubmissionUnknownError(
                f"Vertex image returned HTTP {response.status_code}"
            )
        if response.is_error:
            return ImageProviderOperation(
                "vertex",
                response_id,
                ProviderOperationStatus.FAILED,
                error_code=f"HTTP_{response.status_code}",
            )

        moderation = _moderation(raw)
        encoded, mime_type = _prediction(raw)
        if encoded is None:
            error_code = (
                "PROVIDER_REJECTED"
                if moderation is ModerationDecision.BLOCK
                else "INVALID_PROVIDER_RESPONSE"
            )
            return ImageProviderOperation(
                "vertex",
                response_id,
                ProviderOperationStatus.FAILED,
                error_code=error_code,
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
                response_id,
                ProviderOperationStatus.FAILED,
                error_code="INVALID_IMAGE_OUTPUT",
            )

        result = ImageGenerationResult(
            validated.mime_type,
            content,
            validated.width,
            validated.height,
            moderation,
            validated.sha256,
            {
                "model": request.model_key,
                "finishReason": _finish_reason(raw) or "UNKNOWN",
            },
            _usage(raw),
            None,
        )
        return ImageProviderOperation(
            "vertex",
            response_id,
            ProviderOperationStatus.COMPLETED,
            result=result,
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


def _endpoint(project_id: str, location: str, model_key: str) -> str:
    base_url = (
        "https://aiplatform.googleapis.com"
        if location == "global"
        else f"https://{location}-aiplatform.googleapis.com"
    )
    return (
        f"{base_url}/v1/projects/{project_id}/locations/{location}/publishers/google/models/"
        f"{model_key}:generateContent"
    )


def _request_body(request: ImageGenerationRequest) -> dict[str, object]:
    prompt = request.prompt
    if request.negative_prompt:
        prompt = (
            f"{prompt}\n\nAvoid the following visual elements unless required by the scene: "
            f"{request.negative_prompt}"
        )
    return {
        "contents": [
            {
                "role": "USER",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "candidateCount": 1,
            "imageConfig": {"aspectRatio": request.aspect_ratio.value},
        },
    }


def _response_json(response: httpx.Response) -> dict[str, object]:
    try:
        value = response.json()
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def _candidate(raw: dict[str, object]) -> dict[str, object] | None:
    candidates = raw.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return None
    candidate = candidates[0]
    return candidate if isinstance(candidate, dict) else None


def _prediction(raw: dict[str, object]) -> tuple[str | None, str | None]:
    candidate = _candidate(raw)
    if candidate is None:
        return None, None
    content = candidate.get("content")
    if not isinstance(content, dict):
        return None, None
    parts = content.get("parts")
    if not isinstance(parts, list):
        return None, None
    for part in parts:
        if not isinstance(part, dict):
            continue
        inline_data = part.get("inlineData")
        if not isinstance(inline_data, dict):
            continue
        encoded = inline_data.get("data")
        mime_type = inline_data.get("mimeType", "image/png")
        return (
            encoded if isinstance(encoded, str) else None,
            mime_type if isinstance(mime_type, str) else None,
        )
    return None, None


def _finish_reason(raw: dict[str, object]) -> str | None:
    candidate = _candidate(raw)
    if candidate is None:
        return None
    return _string(candidate.get("finishReason"))


def _moderation(raw: dict[str, object]) -> ModerationDecision:
    candidate = _candidate(raw)
    if candidate is None:
        return ModerationDecision.REVIEW

    ratings = candidate.get("safetyRatings")
    if isinstance(ratings, list):
        for rating in ratings:
            if isinstance(rating, dict) and rating.get("blocked") is True:
                return ModerationDecision.BLOCK

    finish_reason = _finish_reason(raw)
    if finish_reason in {
        "SAFETY",
        "BLOCKLIST",
        "PROHIBITED_CONTENT",
        "IMAGE_SAFETY",
        "RECITATION",
    }:
        return ModerationDecision.BLOCK
    if finish_reason == "STOP":
        return ModerationDecision.SAFE
    return ModerationDecision.REVIEW


def _usage(raw: dict[str, object]) -> dict[str, int | str]:
    metadata = raw.get("usageMetadata")
    if not isinstance(metadata, dict):
        return {}
    usage: dict[str, int | str] = {}
    for key in (
        "promptTokenCount",
        "candidatesTokenCount",
        "totalTokenCount",
        "thoughtsTokenCount",
    ):
        value = metadata.get(key)
        if isinstance(value, int | str):
            usage[key] = value
    return usage


def _string(value: object) -> str | None:
    return value if isinstance(value, str) and value else None
