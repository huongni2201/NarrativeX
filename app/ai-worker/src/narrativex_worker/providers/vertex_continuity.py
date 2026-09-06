"""Continuity-first Vertex orchestration built on shared Vertex transport primitives."""

from __future__ import annotations

from typing import TypeVar

import httpx
from pydantic import BaseModel

from narrativex_worker.analysis_pipeline import run_chapter_analysis_pipeline
from narrativex_worker.continuity.pipeline_contracts import AnalysisStepIdentity
from narrativex_worker.providers.ports import (
    ProviderBilling,
    ProviderCapabilities,
    ProviderOperation,
)
from narrativex_worker.providers.vertex import VertexGeminiTransport, VertexProviderError
from narrativex_worker.schema import ChapterAnalysisRequest, ProviderOperationStatus

ModelT = TypeVar("ModelT", bound=BaseModel)


class _VertexStructuredAdapter:
    def __init__(
        self,
        transport: VertexGeminiTransport,
        client: httpx.AsyncClient,
        access_token: str,
    ) -> None:
        self._transport = transport
        self._client = client
        self._access_token = access_token

    async def generate(
        self,
        prompt: str,
        model: type[ModelT],
        *,
        identity: AnalysisStepIdentity | None = None,
    ) -> tuple[ModelT | None, ProviderBilling, str]:
        # Durable checkpoint consumption is wired separately from the transport call.
        _ = identity
        return await self._transport._bounded_generate_structured(  # noqa: SLF001
            self._client,
            self._access_token,
            prompt,
            model,
        )


class ContinuityVertexGeminiProvider(VertexGeminiTransport):
    """Production Vertex provider using continuity-first chapter orchestration."""

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(provider_key="vertex", supports_story_analysis=True)

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

        states_by_scene: list[list[dict[str, object]]] = []
        for scene_index in range(len(pipeline.analysis.scenes)):
            scene_states: list[dict[str, object]] = []
            shard_keys = sorted(
                key for key in pipeline.continuity_states if key[0] == scene_index
            )
            for key in shard_keys:
                scene_states.extend(
                    state.model_dump(mode="json", by_alias=True)
                    for state in pipeline.continuity_states[key]
                )
            states_by_scene.append(scene_states)

        durable_result = pipeline.analysis.model_copy(
            update={
                "continuity_plan": pipeline.continuity_plan.model_dump(
                    mode="json", by_alias=True
                ),
                "continuity_states": states_by_scene,
                "continuity_report": pipeline.report.model_dump(mode="json", by_alias=True),
            }
        )
        # Revalidate the durable envelope so a cardinality mistake cannot be persisted/replayed.
        durable_result = type(pipeline.analysis).model_validate(
            durable_result.model_dump(mode="json")
        )

        return ProviderOperation(
            provider_key="vertex",
            operation_id=pipeline.final_response_id,
            status=ProviderOperationStatus.COMPLETED,
            result=durable_result,
            billing=self._merge_billings(pipeline.billings),
        )

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        return operation

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        return operation
