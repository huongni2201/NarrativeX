"""Vertex AI Gemini adapter for structured Chapter analysis."""

import asyncio
import json
import uuid
from decimal import Decimal
from typing import TypeVar

import google.auth
import httpx
from google.auth.credentials import Credentials
from google.auth.transport.requests import Request
from pydantic import BaseModel

from narrativex_worker.chapter_analysis_prompts import (
    build_chapter_structure_prompt,
    build_visual_beat_shard_prompt,
)
from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    VisualBeatShard,
    VisualBeatShardResult,
    merge_shard_results,
    plan_visual_beat_shards,
)
from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.ports import (
    LlmProvider,
    ProviderBilling,
    ProviderCapabilities,
    ProviderEstimate,
    ProviderOperation,
    ProviderPricingSnapshot,
    ProviderSubmissionUnknownError,
    ProviderTokenUsage,
)
from narrativex_worker.schema import ChapterAnalysisRequest, ProviderOperationStatus


class VertexProviderError(RuntimeError):
    """Raised when Vertex cannot produce a valid structured Chapter analysis."""


class VertexSubmissionUnknownError(VertexProviderError, ProviderSubmissionUnknownError):
    """The request may have crossed the provider boundary; never blind-retry it."""


ModelT = TypeVar("ModelT", bound=BaseModel)


class VertexGeminiProvider(LlmProvider):
    _MILLION = Decimal("1000000")
    _FLASH_25_INPUT = Decimal("0.15")
    _FLASH_25_CACHED_INPUT = Decimal("0.0375")
    _FLASH_25_OUTPUT = Decimal("0.60")
    _FLASH_25_THINKING_OUTPUT = Decimal("3.50")
    _PRICING_CATALOG_VERSION = "vertex-public-2026-08-19"

    def __init__(self, settings: WorkerSettings) -> None:
        if not settings.vertex_project_id:
            raise VertexProviderError("VERTEX_PROJECT_ID is required when provider_mode=vertex")
        if settings.vertex_model != "gemini-2.5-flash":
            raise VertexProviderError(
                "Actual-cost reconciliation currently requires a pricing rule for the configured "
                f"model; unsupported model={settings.vertex_model}"
            )
        self.settings = settings
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        self._credentials: Credentials = credentials

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(provider_key="vertex", supports_story_analysis=True)

    def estimate(self, request: ChapterAnalysisRequest) -> ProviderEstimate:
        del request
        return ProviderEstimate(min_cost=0.0, max_cost=0.0)

    async def submit(self, request: ChapterAnalysisRequest) -> ProviderOperation:
        try:
            token = await self._access_token()
        except VertexProviderError:
            return ProviderOperation(
                provider_key="vertex",
                operation_id=None,
                status=ProviderOperationStatus.FAILED,
            )

        structure, structure_billing, response_id = await self._generate_structured(
            token,
            build_chapter_structure_prompt(request),
            ChapterStructureResult,
        )
        if structure is None:
            return ProviderOperation(
                provider_key="vertex",
                operation_id=response_id,
                status=ProviderOperationStatus.FAILED,
                billing=structure_billing,
            )

        try:
            shards = plan_visual_beat_shards(
                request.source_text,
                structure,
                target_beats=self.settings.vertex_analysis_shard_target_beats,
                max_beats=self.settings.vertex_analysis_shard_max_beats,
            )
        except ValueError:
            return ProviderOperation(
                provider_key="vertex",
                operation_id=response_id,
                status=ProviderOperationStatus.FAILED,
                billing=structure_billing,
            )

        semaphore = asyncio.Semaphore(self.settings.vertex_analysis_shard_concurrency)

        async def generate(
            shard: VisualBeatShard,
        ) -> tuple[VisualBeatShard, VisualBeatShardResult | None, list[ProviderBilling], str]:
            async with semaphore:
                result, billing, shard_response_id = await self._generate_structured(
                    token,
                    build_visual_beat_shard_prompt(request, structure, shard),
                    VisualBeatShardResult,
                )
                billings = [billing]
                if result is None:
                    return shard, None, billings, shard_response_id

                for _ in range(self.settings.vertex_analysis_repair_attempts):
                    missing = shard.minimum_beats - len(result.visual_beats)
                    if missing <= 0:
                        break
                    repaired, repair_billing, repair_response_id = await self._generate_structured(
                        token,
                        build_visual_beat_shard_prompt(
                            request,
                            structure,
                            shard,
                            missing_count=missing,
                        ),
                        VisualBeatShardResult,
                    )
                    billings.append(repair_billing)
                    shard_response_id = repair_response_id
                    if repaired is None:
                        return shard, None, billings, shard_response_id
                    result = repaired
                return shard, result, billings, shard_response_id

        generated = await asyncio.gather(*(generate(shard) for shard in shards))
        results: dict[tuple[int, int], VisualBeatShardResult] = {}
        all_billings = [structure_billing]
        final_response_id = response_id
        for shard, result, billings, shard_response_id in generated:
            all_billings.extend(billings)
            final_response_id = shard_response_id
            if result is None:
                return ProviderOperation(
                    provider_key="vertex",
                    operation_id=final_response_id,
                    status=ProviderOperationStatus.FAILED,
                    billing=self._merge_billings(all_billings),
                )
            results[(shard.scene_index, shard.shard_index)] = result

        try:
            merged = merge_shard_results(structure, shards, results)
        except ValueError:
            return ProviderOperation(
                provider_key="vertex",
                operation_id=final_response_id,
                status=ProviderOperationStatus.FAILED,
                billing=self._merge_billings(all_billings),
            )

        return ProviderOperation(
            provider_key="vertex",
            operation_id=final_response_id,
            status=ProviderOperationStatus.COMPLETED,
            result=merged,
            billing=self._merge_billings(all_billings),
        )

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        return operation

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        return operation

    async def _generate_structured(
        self,
        token: str,
        prompt: str,
        model: type[ModelT],
    ) -> tuple[ModelT | None, ProviderBilling, str]:
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
                "responseJsonSchema": model.model_json_schema(),
            },
        }
        timeout = httpx.Timeout(
            connect=10.0,
            write=30.0,
            read=self.settings.vertex_timeout_seconds,
            pool=10.0,
        )
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
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
            return None, self._zero_billing(), response_id

        billing = self._billing(raw)
        text = self._candidate_text(raw)
        if text is None:
            return None, billing, response_id
        try:
            parsed = json.loads(text)
            return model.model_validate(parsed), billing, response_id
        except (TypeError, ValueError, json.JSONDecodeError):
            return None, billing, response_id

    def _billing(self, raw: dict[str, object]) -> ProviderBilling:
        usage_raw = raw.get("usageMetadata")
        if not isinstance(usage_raw, dict):
            raise VertexProviderError("Successful Vertex response did not include usageMetadata")

        usage = ProviderTokenUsage(
            prompt_tokens=self._int_field(usage_raw, "promptTokenCount"),
            candidate_tokens=self._int_field(usage_raw, "candidatesTokenCount"),
            thought_tokens=self._int_field(usage_raw, "thoughtsTokenCount"),
            cached_input_tokens=self._int_field(usage_raw, "cachedContentTokenCount"),
            tool_input_tokens=self._int_field(usage_raw, "toolUsePromptTokenCount"),
            total_tokens=self._int_field(usage_raw, "totalTokenCount"),
            traffic_type=self._string_field(usage_raw, "trafficType"),
        )
        uncached_prompt = max(0, usage.prompt_tokens - usage.cached_input_tokens)
        output_rate = (
            self._FLASH_25_THINKING_OUTPUT if usage.thought_tokens > 0 else self._FLASH_25_OUTPUT
        )
        output_tokens = usage.candidate_tokens + usage.thought_tokens
        actual_cost = (
            Decimal(uncached_prompt + usage.tool_input_tokens) * self._FLASH_25_INPUT
            + Decimal(usage.cached_input_tokens) * self._FLASH_25_CACHED_INPUT
            + Decimal(output_tokens) * output_rate
        ) / self._MILLION
        pricing = ProviderPricingSnapshot(
            catalog_version=self._PRICING_CATALOG_VERSION,
            model_key=self.settings.vertex_model,
            location=self.settings.vertex_location,
            pricing_mode="STANDARD_THINKING" if usage.thought_tokens > 0 else "STANDARD",
            input_usd_per_million=self._FLASH_25_INPUT,
            cached_input_usd_per_million=self._FLASH_25_CACHED_INPUT,
            output_usd_per_million=output_rate,
        )
        return ProviderBilling(
            actual_cost=actual_cost.quantize(Decimal("0.000000001")),
            currency="USD",
            usage=usage,
            pricing=pricing,
        )

    def _merge_billings(self, billings: list[ProviderBilling]) -> ProviderBilling:
        prompt_tokens = sum(item.usage.prompt_tokens for item in billings)
        candidate_tokens = sum(item.usage.candidate_tokens for item in billings)
        thought_tokens = sum(item.usage.thought_tokens for item in billings)
        cached_input_tokens = sum(item.usage.cached_input_tokens for item in billings)
        tool_input_tokens = sum(item.usage.tool_input_tokens for item in billings)
        total_tokens = sum(item.usage.total_tokens for item in billings)
        traffic_types = {item.usage.traffic_type for item in billings if item.usage.traffic_type}
        usage = ProviderTokenUsage(
            prompt_tokens=prompt_tokens,
            candidate_tokens=candidate_tokens,
            thought_tokens=thought_tokens,
            cached_input_tokens=cached_input_tokens,
            tool_input_tokens=tool_input_tokens,
            total_tokens=total_tokens,
            traffic_type=next(iter(traffic_types)) if len(traffic_types) == 1 else None,
        )
        output_rate = (
            self._FLASH_25_THINKING_OUTPUT if thought_tokens > 0 else self._FLASH_25_OUTPUT
        )
        pricing = ProviderPricingSnapshot(
            catalog_version=self._PRICING_CATALOG_VERSION,
            model_key=self.settings.vertex_model,
            location=self.settings.vertex_location,
            pricing_mode="SHARDED_THINKING" if thought_tokens > 0 else "SHARDED",
            input_usd_per_million=self._FLASH_25_INPUT,
            cached_input_usd_per_million=self._FLASH_25_CACHED_INPUT,
            output_usd_per_million=output_rate,
        )
        return ProviderBilling(
            actual_cost=sum((item.actual_cost for item in billings), Decimal("0")).quantize(
                Decimal("0.000000001")
            ),
            currency="USD",
            usage=usage,
            pricing=pricing,
        )

    def _zero_billing(self) -> ProviderBilling:
        return ProviderBilling(
            actual_cost=Decimal("0.000000000"),
            currency="USD",
            usage=ProviderTokenUsage(prompt_tokens=0, candidate_tokens=0),
            pricing=ProviderPricingSnapshot(
                catalog_version=self._PRICING_CATALOG_VERSION,
                model_key=self.settings.vertex_model,
                location=self.settings.vertex_location,
                pricing_mode="NOT_CHARGED_NON_200",
                input_usd_per_million=self._FLASH_25_INPUT,
                cached_input_usd_per_million=self._FLASH_25_CACHED_INPUT,
                output_usd_per_million=self._FLASH_25_OUTPUT,
            ),
        )

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
