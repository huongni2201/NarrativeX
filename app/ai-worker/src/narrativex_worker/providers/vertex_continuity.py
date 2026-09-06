"""Continuity-first Vertex orchestration built on shared Vertex transport primitives."""

from __future__ import annotations

from typing import TypeVar

import httpx
from pydantic import BaseModel

from narrativex_worker.analysis_execution import ChapterAnalysisExecutionContext
from narrativex_worker.analysis_pipeline import run_chapter_analysis_pipeline
from narrativex_worker.continuity.pipeline_contracts import AnalysisStepIdentity
from narrativex_worker.providers.ports import (
    ProviderBilling,
    ProviderCapabilities,
    ProviderOperation,
)
from narrativex_worker.providers.vertex import (
    VertexGeminiTransport,
    VertexProviderError,
    VertexSubmissionUnknownError,
)
from narrativex_worker.repository.analysis_checkpoints import AnalysisCheckpointStatus
from narrativex_worker.repository.analysis_fingerprint import analysis_step_fingerprint
from narrativex_worker.schema import ChapterAnalysisRequest, ProviderOperationStatus

ModelT = TypeVar("ModelT", bound=BaseModel)


class _VertexStructuredAdapter:
    def __init__(
        self,
        transport: VertexGeminiTransport,
        client: httpx.AsyncClient,
        access_token: str,
        *,
        request: ChapterAnalysisRequest | None = None,
        execution: ChapterAnalysisExecutionContext | None = None,
    ) -> None:
        self._transport = transport
        self._client = client
        self._access_token = access_token
        self._request = request
        self._execution = execution
        self.billings: list[ProviderBilling] = []
        self.reused_subcalls = 0

    async def generate(
        self,
        prompt: str,
        model: type[ModelT],
        *,
        identity: AnalysisStepIdentity | None = None,
    ) -> tuple[ModelT | None, ProviderBilling, str]:
        if self._execution is None or identity is None or self._request is None:
            result, billing, response_id = await self._transport._bounded_generate_structured(  # noqa: SLF001
                self._client,
                self._access_token,
                prompt,
                model,
            )
            self.billings.append(billing)
            return result, billing, response_id

        fingerprint = analysis_step_fingerprint(
            tenant_scope=f"project:{self._request.project_id}",
            chapter_source_hash=self._request.source_hash,
            step_kind=identity.step_key.split(":", 1)[0],
            owned_source_range=identity.owned_source_range,
            input_canon_versions=[],
            continuity_inputs=identity.continuity_inputs,
            model_config={
                "provider": "vertex",
                "model": self._transport.settings.vertex_model,
                "location": self._transport.settings.vertex_location,
                "temperature": "0.2",
                "responseModel": model.__name__,
            },
            prompt_version=identity.prompt_version,
            schema_version=identity.schema_version,
        )
        checkpoint = await self._execution.checkpoints.claim(
            stage_attempt_id=self._execution.stage_attempt_id,
            step_key=identity.step_key,
            input_fingerprint=fingerprint,
            claim_owner=self._execution.claim_owner,
        )
        if checkpoint.status is AnalysisCheckpointStatus.COMPLETED:
            payload = checkpoint.result_json or {}
            result_payload = payload.get("result")
            response_id = payload.get("responseId")
            if not isinstance(result_payload, dict) or not isinstance(response_id, str):
                raise RuntimeError("completed analysis checkpoint has an invalid durable result")
            self.reused_subcalls += 1
            return model.model_validate(result_payload), self._transport._zero_billing(), response_id  # noqa: SLF001
        if checkpoint.status is AnalysisCheckpointStatus.UNKNOWN:
            raise VertexSubmissionUnknownError(
                f"Analysis subcall {identity.step_key} has UNKNOWN provider outcome; "
                "refusing blind resubmission"
            )

        checkpoint = await self._execution.checkpoints.begin_provider_call(
            checkpoint,
            provider_key="vertex",
        )
        result, billing, response_id = await self._transport._bounded_generate_structured(  # noqa: SLF001
            self._client,
            self._access_token,
            prompt,
            model,
        )
        self.billings.append(billing)
        if result is None:
            await self._execution.checkpoints.fail_provider_call(
                checkpoint,
                provider_response_id=response_id,
                billing=billing,
            )
            return None, billing, response_id

        durable_result = {
            "responseId": response_id,
            "result": result.model_dump(mode="json", by_alias=True),
        }
        await self._execution.checkpoints.complete_provider_call(
            checkpoint,
            result=durable_result,
            provider_response_id=response_id,
            billing=billing,
        )
        return result, billing, response_id


class ContinuityVertexGeminiProvider(VertexGeminiTransport):
    """Production Vertex provider using continuity-first chapter orchestration."""

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            provider_key="vertex",
            supports_story_analysis=True,
            supports_durable_subcall_resume=True,
        )

    async def submit(
        self,
        request: ChapterAnalysisRequest,
        *,
        execution: ChapterAnalysisExecutionContext | None = None,
    ) -> ProviderOperation:
        try:
            token = await self._access_token()
        except VertexProviderError as exception:
            self.logger.error("Vertex access token acquisition failed: %s", exception)
            return ProviderOperation(
                provider_key="vertex",
                operation_id=None,
                status=ProviderOperationStatus.FAILED,
                billing=self._zero_billing(),
            )

        limits = httpx.Limits(
            max_connections=self.settings.vertex_analysis_shard_concurrency,
            max_keepalive_connections=self.settings.vertex_analysis_shard_concurrency,
        )
        adapter: _VertexStructuredAdapter | None = None
        try:
            async with httpx.AsyncClient(timeout=self._http_timeout(), limits=limits) as client:
                adapter = _VertexStructuredAdapter(
                    self,
                    client,
                    token,
                    request=request,
                    execution=execution,
                )
                pipeline = await run_chapter_analysis_pipeline(
                    request=request,
                    adapter=adapter,
                    target_beats=self.settings.vertex_analysis_shard_target_beats,
                    max_beats=self.settings.vertex_analysis_shard_max_beats,
                    repair_attempts=self.settings.vertex_analysis_repair_attempts,
                )
        except ValueError as exception:
            self.logger.error(
                "Vertex continuity pipeline rejected chapter=%s reason=%s",
                request.chapter_id,
                self._safe_exception_reason(exception),
            )
            billings = adapter.billings if adapter is not None else []
            billing = (
                self._orchestration_billing()
                if execution is not None
                else self._merge_billings(billings)
                if billings
                else self._zero_billing()
            )
            return ProviderOperation(
                provider_key="vertex",
                operation_id=None,
                status=ProviderOperationStatus.FAILED,
                billing=billing,
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
            billing=(
                self._orchestration_billing()
                if execution is not None
                else self._merge_billings(pipeline.billings)
            ),
        )

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        return operation

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        return operation
