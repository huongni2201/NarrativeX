"""Adapter for a private/self-hosted Wan image-to-video inference endpoint.

The endpoint is intentionally model-server agnostic. NarrativeX sends an idempotent request_id,
persists durable ProviderOperation state outside this adapter, and reconciles ambiguous submissions
by request identity before any retry.
"""

from urllib.parse import quote

import httpx

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.ports import (
    ProviderCapabilities,
    ProviderSubmissionRejectedError,
    ProviderSubmissionUnknownError,
    VideoGenerationProvider,
    VideoGenerationRequest,
    VideoProviderOperation,
)
from narrativex_worker.schema import ProviderOperationStatus


class WanProviderError(RuntimeError):
    """Raised when the configured Wan endpoint returns an invalid contract."""


class WanSubmissionUnknownError(WanProviderError, ProviderSubmissionUnknownError):
    """Submission may have crossed the Wan endpoint boundary; reconcile before retry."""


class WanVideoProvider(VideoGenerationProvider):
    """HTTP adapter for a private Wan2.2-compatible inference service."""

    def __init__(
        self,
        settings: WorkerSettings,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not settings.wan_video_enabled:
            raise WanProviderError("WAN_VIDEO_ENABLED must be true to configure WanVideoProvider")
        if not settings.wan_endpoint_url:
            raise WanProviderError("WAN_ENDPOINT_URL is required when Wan video is enabled")
        self.settings = settings
        self._base_url = settings.wan_endpoint_url.rstrip("/")
        self._transport = transport

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            provider_key="wan-local",
            supports_story_analysis=False,
            supports_video_generation=True,
            supports_operation_reconciliation=True,
        )

    async def submit(self, request: VideoGenerationRequest) -> VideoProviderOperation:
        body = {
            "request_id": request.request_id,
            "model": self.settings.wan_model,
            "image_url": request.image_url,
            "prompt": request.prompt,
            "duration_seconds": request.duration_seconds,
            "resolution": request.resolution.value,
        }
        if request.negative_prompt:
            body["negative_prompt"] = request.negative_prompt

        try:
            response = await self._request("POST", "/v1/image-to-video", json=body)
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise WanSubmissionUnknownError(
                f"Wan submission outcome is unknown: {type(exception).__name__}"
            ) from exception

        if response.status_code >= 500:
            raise WanSubmissionUnknownError(
                f"Wan endpoint returned HTTP {response.status_code}; execution outcome is unknown"
            )
        if response.is_error:
            raise ProviderSubmissionRejectedError(
                f"Wan endpoint rejected submission with HTTP {response.status_code}"
            )

        raw = self._response_json(response)
        operation_id = self._required_string(raw, "operation_id")
        return self._operation_from_raw(
            raw,
            request_id=request.request_id,
            operation_id=operation_id,
            default_status=ProviderOperationStatus.SUBMITTED,
        )

    async def get_status(self, operation: VideoProviderOperation) -> VideoProviderOperation:
        path = self._status_path(operation)
        try:
            response = await self._request("GET", path)
        except (httpx.TimeoutException, httpx.NetworkError):
            return VideoProviderOperation(
                provider_key="wan-local",
                request_id=operation.request_id,
                operation_id=operation.operation_id,
                status=ProviderOperationStatus.UNKNOWN,
                output_url=operation.output_url,
                error_code="STATUS_UNAVAILABLE",
            )

        if response.status_code == 404:
            return VideoProviderOperation(
                provider_key="wan-local",
                request_id=operation.request_id,
                operation_id=operation.operation_id,
                status=ProviderOperationStatus.UNKNOWN,
                error_code="OPERATION_NOT_FOUND",
            )
        if response.is_error:
            return VideoProviderOperation(
                provider_key="wan-local",
                request_id=operation.request_id,
                operation_id=operation.operation_id,
                status=ProviderOperationStatus.UNKNOWN,
                error_code=f"STATUS_HTTP_{response.status_code}",
            )

        raw = self._response_json(response)
        operation_id = self._optional_string(raw, "operation_id") or operation.operation_id
        return self._operation_from_raw(
            raw,
            request_id=operation.request_id,
            operation_id=operation_id,
            default_status=ProviderOperationStatus.UNKNOWN,
        )

    async def reconcile(self, operation: VideoProviderOperation) -> VideoProviderOperation:
        """Reconcile by operation id or idempotent request id; never submit from this method."""

        return await self.get_status(operation)

    def _status_path(self, operation: VideoProviderOperation) -> str:
        if operation.operation_id:
            return f"/v1/operations/{quote(operation.operation_id, safe='')}"
        return f"/v1/operations/by-request/{quote(operation.request_id, safe='')}"

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, object] | None = None,
    ) -> httpx.Response:
        headers = {"Accept": "application/json"}
        if self.settings.wan_api_token is not None:
            headers["Authorization"] = f"Bearer {self.settings.wan_api_token.get_secret_value()}"

        async with httpx.AsyncClient(
            base_url=self._base_url,
            timeout=self.settings.wan_request_timeout_seconds,
            transport=self._transport,
        ) as client:
            return await client.request(method, path, headers=headers, json=json)

    @classmethod
    def _operation_from_raw(
        cls,
        raw: dict[str, object],
        *,
        request_id: str,
        operation_id: str | None,
        default_status: ProviderOperationStatus,
    ) -> VideoProviderOperation:
        status = cls._status(raw, default_status)
        output_url = cls._optional_string(raw, "output_url")
        error_code = cls._optional_string(raw, "error_code")
        if status is ProviderOperationStatus.COMPLETED and not output_url:
            raise WanProviderError("COMPLETED Wan operation is missing output_url")
        return VideoProviderOperation(
            provider_key="wan-local",
            request_id=request_id,
            operation_id=operation_id,
            status=status,
            output_url=output_url,
            error_code=error_code,
        )

    @staticmethod
    def _status(
        raw: dict[str, object], default_status: ProviderOperationStatus
    ) -> ProviderOperationStatus:
        value = raw.get("status")
        if value is None:
            return default_status
        if not isinstance(value, str):
            raise WanProviderError("Wan operation status must be a string")
        normalized = value.upper()
        if normalized == "QUEUED":
            normalized = ProviderOperationStatus.SUBMITTED.value
        try:
            return ProviderOperationStatus(normalized)
        except ValueError as exception:
            raise WanProviderError(f"Unsupported Wan operation status: {value}") from exception

    @staticmethod
    def _response_json(response: httpx.Response) -> dict[str, object]:
        try:
            value = response.json()
        except ValueError as exception:
            raise WanProviderError("Wan endpoint returned non-JSON response") from exception
        if not isinstance(value, dict):
            raise WanProviderError("Wan endpoint response must be a JSON object")
        return {str(key): item for key, item in value.items()}

    @classmethod
    def _required_string(cls, raw: dict[str, object], field: str) -> str:
        value = cls._optional_string(raw, field)
        if value is None:
            raise WanProviderError(f"Wan endpoint response missing {field}")
        return value

    @staticmethod
    def _optional_string(raw: dict[str, object], field: str) -> str | None:
        value = raw.get(field)
        if value is None:
            return None
        if not isinstance(value, str) or not value:
            raise WanProviderError(f"Wan endpoint field {field} must be a non-empty string")
        return value
