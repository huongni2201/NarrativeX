"""Continuity-first Vertex orchestration built on the existing Vertex transport primitives."""

from __future__ import annotations

import httpx
from pydantic import BaseModel

from narrativex_worker.analysis_pipeline import run_chapter_analysis_pipeline
from narrativex_worker.providers.ports import ProviderBilling, ProviderOperation
from narrativex_worker.providers.vertex import VertexGeminiProvider, VertexProviderError
from narrativex_worker.schema import ChapterAnalysisRequest, ProviderOperationStatus


class _VertexStructuredAdapter:
    def __init__(
        self,
        provider: VertexGeminiProvider,
        client: httpx.AsyncClient,
        access_token: str,
    ) -> None:
        self._provider = provider
        self._client = client
        self._access_token = access_token

    async def generate(self, prompt: str, model: type[BaseModel]):
        return await self._provider._bounded_generate_structured(  # noqa: SLF001
            self._client,
            self._access_token,
            prompt,
            model,
        )


class ContinuityVertexGeminiProvider(VertexGeminiProvider):
    """Production chapter-analysis adapter using continuity-first orchestration."""

    async def submit(self, request: ChapterAnalysisRequest) -> ProviderOperation:
        try:
            token = await self._access_token()
        except VertexProviderError as exception:
            self.logger.error("Vertex access token acquisition failed: %s", exception)
            return ProviderOperation(
                provider_key="vertex",
                operation_id=None,
                status=ProviderOperationStatus.FAILED,
            )

        limits = httpx.Limits(
            max_connections=self.settings.vertex_analysis_shard_concurrency,
            max_keepalive_connections=self.settings.vertex_analysis_shard_concurrency,
        )
        billings: list[ProviderBilling] = []
        try:
            async with httpx.AsyncClient(timeout=self._http_timeout(), limits=limits) as client:
                pipeline = await run_chapter_analysis_pipeline(
                    request=request,
                    adapter=_VertexStructuredAdapter(self, client, token),
                    target_beats=self.settings.vertex_analysis_shard_target_beats,
                    max_beats=self.settings.vertex_analysis_shard_max_beats,
                    repair_attempts=self.settings.vertex_analysis_repair_attempts,
                )
                billings.extend(pipeline.billings)
        except ValueError as exception:
            self.logger.error(
                "Vertex continuity pipeline rejected chapter=%s reason=%s",
                request.chapter_id,
                self._safe_exception_reason(exception),
            )
            return ProviderOperation(
                provider_key="vertex",
                operation_id=None,
                status=ProviderOperationStatus.FAILED,
                billing=self._merge_billings(billings) if billings else None,
            )

        if pipeline.report.status.value != "PASS":
            self.logger.warning(
                "Vertex continuity pipeline requires review chapter=%s issues=%s",
                request.chapter_id,
                len(pipeline.report.issues),
            )

        return ProviderOperation(
            provider_key="vertex",
            operation_id=pipeline.final_response_id,
            status=ProviderOperationStatus.COMPLETED,
            result=pipeline.analysis,
            billing=self._merge_billings(pipeline.billings),
        )
