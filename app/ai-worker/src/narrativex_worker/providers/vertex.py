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
)
from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    ProviderOperationStatus,
)


class VertexProviderError(RuntimeError):
    """Raised when Vertex cannot produce a valid structured Chapter analysis."""


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
        token = await self._access_token()
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
        async with httpx.AsyncClient(timeout=self.settings.vertex_timeout_seconds) as client:
            response = await client.post(
                endpoint,
                headers={"Authorization": f"Bearer {token}"},
                json=body,
            )
        if response.is_error:
            raise VertexProviderError(
                f"Vertex generateContent failed with HTTP {response.status_code}: "
                f"{response.text[:1000]}"
            )

        raw = response.json()
        try:
            text = raw["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            result = ChapterAnalysisResult.model_validate(parsed)
        except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exception:
            raise VertexProviderError(
                "Vertex returned an invalid Chapter analysis payload"
            ) from exception

        return ProviderOperation(
            provider_key="vertex",
            operation_id=raw.get("responseId") or str(uuid.uuid4()),
            status=ProviderOperationStatus.COMPLETED,
            result=result,
        )

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        return operation

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        return operation

    async def _access_token(self) -> str:
        if not self._credentials.valid or not self._credentials.token:
            await asyncio.to_thread(self._credentials.refresh, Request())
        token = self._credentials.token
        if not isinstance(token, str) or not token:
            raise VertexProviderError("Unable to acquire Vertex access token from ADC")
        return token
