"""Vertex AI Gemini adapter for structured Chapter analysis."""

import asyncio
import json
import uuid

import google.auth
import httpx
from google.auth.credentials import Credentials
from google.auth.transport.requests import Request

from narrativex_worker.config import WorkerSettings
from narrativex_worker.prompting import build_chapter_analysis_prompt
from narrativex_worker.providers.ports import (
    LlmProvider,
    ProviderCapabilities,
    ProviderEstimate,
    ProviderOperation,
    ProviderSubmissionUnknownError,
)
from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    ProviderOperationStatus,
)


class VertexProviderError(RuntimeError):
    """Raised when Vertex cannot produce a valid structured Chapter analysis."""


class VertexSubmissionUnknownError(VertexProviderError, ProviderSubmissionUnknownError):
    """The request may have crossed the provider boundary; never blind-retry it."""


class VertexGeminiProvider(LlmProvider):
    def __init__(self, settings: WorkerSettings) -> None:
        if not settings.vertex_project_id:
            raise VertexProviderError("VERTEX_PROJECT_ID is required when provider_mode=vertex")
        self.settings = settings
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        self._credentials: Credentials = credentials

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(provider_key="vertex", supports_story_analysis=True)

    def estimate(self, request: ChapterAnalysisRequest) -> ProviderEstimate:
        # Cost policy belongs to the backend OperationPlan. This adapter exposes a conservative
        # provider-neutral placeholder until token pricing is wired into the planning service.
        del request
        return ProviderEstimate(min_cost=0.0, max_cost=0.0)

    async def submit(self, request: ChapterAnalysisRequest) -> ProviderOperation:
        try:
            token = await self._access_token()
        except VertexProviderError:
            # Authentication failed before any generation request crossed the provider boundary.
            return ProviderOperation(
                provider_key="vertex",
                operation_id=None,
                status=ProviderOperationStatus.FAILED,
            )

        endpoint = (
            f"https://{self.settings.vertex_location}-aiplatform.googleapis.com/v1/projects/"
            f"{self.settings.vertex_project_id}/locations/{self.settings.vertex_location}/"
            f"publishers/google/models/{self.settings.vertex_model}:generateContent"
        )
        response_schema = ChapterAnalysisResult.model_json_schema()
        body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": build_chapter_analysis_prompt(request)}],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
                "responseJsonSchema": response_schema,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.settings.vertex_timeout_seconds) as client:
                response = await client.post(
                    endpoint,
                    headers={"Authorization": f"Bearer {token}"},
                    json=body,
                )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise VertexSubmissionUnknownError(
                f"Vertex submission outcome is unknown: {type(exception).__name__}"
            ) from exception

        raw = self._response_json(response)
        response_id = self._response_id(raw)

        if response.status_code >= 500:
            raise VertexSubmissionUnknownError(
                f"Vertex returned HTTP {response.status_code}; execution outcome is unknown"
            )

        if response.is_error:
            return ProviderOperation(
                provider_key="vertex",
                operation_id=response_id,
                status=ProviderOperationStatus.FAILED,
            )

        try:
            text = raw["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            result = ChapterAnalysisResult.model_validate(parsed)
        except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError):
            # A successful HTTP response means the provider call already executed. Treat schema
            # failure as terminal instead of retrying and potentially paying for the same work.
            return ProviderOperation(
                provider_key="vertex",
                operation_id=response_id,
                status=ProviderOperationStatus.FAILED,
            )

        return ProviderOperation(
            provider_key="vertex",
            operation_id=response_id,
            status=ProviderOperationStatus.COMPLETED,
            result=result,
        )

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        return operation

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        # generateContent is synchronous and currently exposes no operation lookup contract that
        # can reconstruct a lost response. Preserve UNKNOWN rather than resubmitting blindly.
        return operation

    async def _access_token(self) -> str:
        if self._credentials.valid and isinstance(self._credentials.token, str):
            return self._credentials.token

        last_exception: Exception | None = None
        for attempt in range(3):
            try:
                await asyncio.to_thread(self._credentials.refresh, Request())
                token = self._credentials.token
                if isinstance(token, str) and token:
                    return token
                last_exception = VertexProviderError("ADC returned an empty access token")
            except Exception as exception:  # google-auth exposes multiple transport/auth errors
                last_exception = exception
            if attempt < 2:
                await asyncio.sleep(0.25 * (2**attempt))

        raise VertexProviderError("Unable to acquire Vertex access token from ADC") from last_exception

    @staticmethod
    def _response_json(response: httpx.Response) -> dict[str, object]:
        try:
            value = response.json()
        except ValueError:
            return {}
        return value if isinstance(value, dict) else {}

    @staticmethod
    def _response_id(raw: dict[str, object]) -> str:
        response_id = raw.get("responseId")
        return response_id if isinstance(response_id, str) and response_id else str(uuid.uuid4())
