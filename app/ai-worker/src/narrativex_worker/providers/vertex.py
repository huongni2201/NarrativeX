"""Shared Vertex AI Gemini transport primitives."""

import asyncio
import json
import logging
import uuid
from typing import TypeVar

import google.auth
import httpx
from google.auth.credentials import Credentials
from google.auth.transport.requests import Request
from pydantic import BaseModel, ValidationError

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.ports import (
    ProviderSubmissionUnknownError,
    ProviderTokenUsage,
)
from narrativex_worker.providers.vertex_schema import response_json_schema, safe_error_diagnostic


class VertexProviderError(RuntimeError):
    """Raised when Vertex cannot produce a valid structured Chapter analysis."""


class VertexSubmissionUnknownError(VertexProviderError, ProviderSubmissionUnknownError):
    """The request may have crossed the provider boundary; never blind-retry it."""


ModelT = TypeVar("ModelT", bound=BaseModel)


class VertexGeminiTransport:
    """Shared Vertex auth, HTTP and structured-output transport primitives."""

    def __init__(self, settings: WorkerSettings) -> None:
        if not settings.vertex_project_id:
            raise VertexProviderError("VERTEX_PROJECT_ID is required when provider_mode=vertex")
        self.settings = settings
        self.logger = logging.getLogger("narrativex.worker.vertex")
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        self._credentials: Credentials = credentials
        self._analysis_request_gate = asyncio.Semaphore(
            settings.vertex_analysis_shard_concurrency
        )

    @staticmethod
    def _safe_validation_reason(exception: ValidationError) -> str:
        """Return Pydantic field paths and error types without serializing rejected input."""
        reasons: list[str] = []
        for error in exception.errors(include_input=False, include_url=False):
            location = ".".join(str(part) for part in error.get("loc", ())) or "root"
            error_type = str(error.get("type", "validation_error"))
            reasons.append(f"{location}:{error_type}")
        return ",".join(reasons[:8]) or "ValidationError"

    @staticmethod
    def _safe_exception_reason(exception: BaseException) -> str:
        """Return a diagnostic label without serializing model input or story content."""
        if isinstance(exception, ValidationError):
            return VertexGeminiTransport._safe_validation_reason(exception)
        return type(exception).__name__

    def _http_timeout(self) -> httpx.Timeout:
        return httpx.Timeout(
            connect=10.0,
            write=30.0,
            read=self.settings.vertex_timeout_seconds,
            pool=10.0,
        )

    async def _bounded_generate_structured(
        self,
        client: httpx.AsyncClient,
        token: str,
        prompt: str,
        model: type[ModelT],
    ) -> tuple[ModelT | None, ProviderTokenUsage, str]:
        async with self._analysis_request_gate:
            return await self._generate_structured(client, token, prompt, model)

    async def _generate_structured(
        self,
        client: httpx.AsyncClient,
        token: str,
        prompt: str,
        model: type[ModelT],
    ) -> tuple[ModelT | None, ProviderTokenUsage, str]:
        endpoint = (
            f"https://{self.settings.vertex_location}-aiplatform.googleapis.com/v1/projects/"
            f"{self.settings.vertex_project_id}/locations/{self.settings.vertex_location}/"
            f"publishers/google/models/{self.settings.vertex_model}:generateContent"
        )
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
                "responseJsonSchema": response_json_schema(model),
            },
        }
        try:
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
            provider_status, field_paths = safe_error_diagnostic(raw)
            self.logger.error(
                "Vertex structured request failed httpStatus=%s responseId=%s model=%s "
                "providerStatus=%s fieldPaths=%s",
                response.status_code,
                response_id,
                model.__name__,
                provider_status,
                ",".join(field_paths) if field_paths else None,
            )
            return None, self._zero_usage(), response_id

        usage = self._usage(raw)
        text = self._candidate_text(raw)
        if text is None:
            self.logger.error(
                "Vertex response missing candidate text responseId=%s model=%s",
                response_id,
                model.__name__,
            )
            return None, usage, response_id
        try:
            parsed = json.loads(text)
            return model.model_validate(parsed), usage, response_id
        except (TypeError, ValueError, json.JSONDecodeError) as exception:
            self.logger.warning(
                "Vertex structured response validation failed responseId=%s model=%s reason=%s",
                response_id,
                model.__name__,
                self._safe_exception_reason(exception),
            )
            return None, usage, response_id

    def _usage(self, raw: dict[str, object]) -> ProviderTokenUsage:
        """Capture token telemetry without pricing or monetary accounting."""
        usage_raw = raw.get("usageMetadata")
        if not isinstance(usage_raw, dict):
            return self._zero_usage()
        return ProviderTokenUsage(
            prompt_tokens=self._int_field(usage_raw, "promptTokenCount"),
            candidate_tokens=self._int_field(usage_raw, "candidatesTokenCount"),
            thought_tokens=self._int_field(usage_raw, "thoughtsTokenCount"),
            cached_input_tokens=self._int_field(usage_raw, "cachedContentTokenCount"),
            tool_input_tokens=self._int_field(usage_raw, "toolUsePromptTokenCount"),
            total_tokens=self._int_field(usage_raw, "totalTokenCount"),
            traffic_type=self._string_field(usage_raw, "trafficType"),
        )

    @staticmethod
    def _merge_usage(usages: list[ProviderTokenUsage]) -> ProviderTokenUsage:
        traffic_types = {item.traffic_type for item in usages if item.traffic_type}
        return ProviderTokenUsage(
            prompt_tokens=sum(item.prompt_tokens for item in usages),
            candidate_tokens=sum(item.candidate_tokens for item in usages),
            thought_tokens=sum(item.thought_tokens for item in usages),
            cached_input_tokens=sum(item.cached_input_tokens for item in usages),
            tool_input_tokens=sum(item.tool_input_tokens for item in usages),
            total_tokens=sum(item.total_tokens for item in usages),
            traffic_type=next(iter(traffic_types)) if len(traffic_types) == 1 else None,
        )

    @staticmethod
    def _zero_usage() -> ProviderTokenUsage:
        return ProviderTokenUsage(prompt_tokens=0, candidate_tokens=0)

    async def _access_token(self) -> str:
        if self._credentials.valid and isinstance(self._credentials.token, str):
            return self._credentials.token

        last_exception: Exception | None = None
        for attempt in range(3):
            try:
                refresh_request = Request()
                await asyncio.to_thread(self._credentials.refresh, refresh_request)
                token = self._credentials.token
                if isinstance(token, str) and token:
                    return token
                last_exception = VertexProviderError("ADC returned an empty access token")
            except Exception as exception:
                last_exception = exception
            if attempt < 2:
                await asyncio.sleep(0.25 * (2**attempt))

        raise VertexProviderError(
            "Unable to acquire Vertex access token from ADC"
        ) from last_exception

    @staticmethod
    def _response_json(response: httpx.Response) -> dict[str, object]:
        try:
            value = response.json()
        except ValueError:
            return {}
        if not isinstance(value, dict):
            return {}
        return {str(key): item for key, item in value.items()}

    @staticmethod
    def _candidate_text(raw: dict[str, object]) -> str | None:
        candidates = raw.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            return None
        candidate = candidates[0]
        if not isinstance(candidate, dict):
            return None
        content = candidate.get("content")
        if not isinstance(content, dict):
            return None
        parts = content.get("parts")
        if not isinstance(parts, list) or not parts:
            return None
        part = parts[0]
        if not isinstance(part, dict):
            return None
        text = part.get("text")
        return text if isinstance(text, str) else None

    @staticmethod
    def _response_id(raw: dict[str, object]) -> str:
        response_id = raw.get("responseId")
        return response_id if isinstance(response_id, str) and response_id else str(uuid.uuid4())

    @staticmethod
    def _int_field(raw: dict[str, object], key: str) -> int:
        value = raw.get(key, 0)
        return value if isinstance(value, int) and value >= 0 else 0

    @staticmethod
    def _string_field(raw: dict[str, object], key: str) -> str | None:
        value = raw.get(key)
        return value if isinstance(value, str) and value else None
