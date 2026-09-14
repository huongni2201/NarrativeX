"""Continuity-first chapter orchestration using a private local Qwen runtime."""

from __future__ import annotations

from typing import TypeVar

import httpx
from pydantic import BaseModel

from narrativex_worker.analysis_execution import ChapterAnalysisExecutionContext
from narrativex_worker.analysis_pipeline import run_chapter_analysis_pipeline
from narrativex_worker.continuity.pipeline_contracts import AnalysisStepIdentity
from narrativex_worker.providers.ports import (
    ProviderCapabilities,
    ProviderOperation,
    ProviderTokenUsage,
)
from narrativex_worker.providers.qwen import QwenOpenAITransport, QwenSubmissionUnknownError
from narrativex_worker.repository.analysis_checkpoints import AnalysisCheckpointStatus
from narrativex_worker.repository.analysis_fingerprint import analysis_step_fingerprint
from narrativex_worker.schema import ChapterAnalysisRequest, ProviderOperationStatus

ModelT = TypeVar("ModelT", bound=BaseModel)


class _QwenStructuredAdapter:
    def __init__(
        self,
        transport: QwenOpenAITransport,
        client: httpx.AsyncClient,
        *,
        request: ChapterAnalysisRequest | None = None,
        execution: ChapterAnalysisExecutionContext | None = None,
    ) -> None:
        self._transport = transport
        self._client = client
        self._request = request
        self._execution = execution
        self.usages: list[ProviderTokenUsage] = []
        self.reused_subcalls = 0

    async def generate(
        self,
        prompt: str,
        model: type[ModelT],
        *,
        identity: AnalysisStepIdentity | None = None,
    ) -> tuple[ModelT | None, ProviderTokenUsage, str]:
        if self._execution is None or identity is None or self._request is None:
            result, usage, response_id = await self._transport._bounded_generate_structured(  # noqa: SLF001
                self._client,
                prompt,
                model,
            )
            self.usages.append(usage)
            return result, usage, response_id

        fingerprint = analysis_step_fingerprint(
            tenant_scope=f"project:{self._request.project_id}",
            chapter_source_hash=self._request.source_hash,
            step_kind=identity.step_key.split(":", 1)[0],
            owned_source_range=identity.owned_source_range,
            input_canon_versions=[],
            continuity_inputs=identity.continuity_inputs,
            model_config={
                "provider": "qwen-local",
                "model": self._transport.settings.qwen_model,
                "temperature": "0.2",
                "thinking": False,
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
            checkpoint_response_id = payload.get("responseId")
            if not isinstance(result_payload, dict) or not isinstance(checkpoint_response_id, str):
                raise RuntimeError("completed analysis checkpoint has an invalid durable result")
            self.reused_subcalls += 1
            return (
                model.model_validate(result_payload),
                self._transport._zero_usage(),  # noqa: SLF001
                checkpoint_response_id,
            )
        if checkpoint.status is AnalysisCheckpointStatus.UNKNOWN:
            raise QwenSubmissionUnknownError(
                f"Analysis subcall {identity.step_key} has UNKNOWN local inference outcome; "
                "refusing blind resubmission"
            )

        checkpoint = await self._execution.checkpoints.begin_provider_call(
            checkpoint,
            provider_key="qwen-local",
        )
        result, usage, response_id = await self._transport._bounded_generate_structured(  # noqa: SLF001
            self._client,
            prompt,
            model,
        )
        self.usages.append(usage)
        if result is None:
            await self._execution.checkpoints.fail_provider_call(
                checkpoint,
                provider_response_id=response_id,
            )
            return None, usage, response_id

        durable_result = {
            "responseId": response_id,
            "result": result.model_dump(mode="json", by_alias=True),
        }
        await self._execution.checkpoints.complete_provider_call(
            checkpoint,
            result=durable_result,
            provider_response_id=response_id,
        )
        return result, usage, response_id


class ContinuityQwenProvider(QwenOpenAITransport):
    """Production chapter-analysis provider backed by local Qwen3 inference."""

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            provider_key="qwen-local",
            supports_story_analysis=True,
            supports_durable_subcall_resume=True,
        )

    async def submit(
        self,
        request: ChapterAnalysisRequest,
        *,
        execution: ChapterAnalysisExecutionContext | None = None,
    ) -> ProviderOperation:
        limits = httpx.Limits(
            max_connections=self.settings.qwen_analysis_shard_concurrency,
            max_keepalive_connections=self.settings.qwen_analysis_shard_concurrency,
        )
        adapter: _QwenStructuredAdapter | None = None
        try:
            async with httpx.AsyncClient(timeout=self._http_timeout(), limits=limits) as client:
                adapter = _QwenStructuredAdapter(
                    self,
                    client,
                    request=request,
                    execution=execution,
                )
                pipeline = await run_chapter_analysis_pipeline(
                    request=request,
                    adapter=adapter,
                    target_beats=self.settings.qwen_analysis_shard_target_beats,
                    max_beats=self.settings.qwen_analysis_shard_max_beats,
                    repair_attempts=self.settings.qwen_analysis_repair_attempts,
                )
        except ValueError as exception:
            self.logger.error(
                "Qwen continuity pipeline rejected chapter=%s reason=%s",
                request.chapter_id,
                self._safe_exception_reason(exception),
            )
            usages = adapter.usages if adapter is not None else []
            return ProviderOperation(
                provider_key="qwen-local",
                operation_id=None,
                status=ProviderOperationStatus.FAILED,
                usage=self._merge_usage(usages) if usages else self._zero_usage(),
            )

        if pipeline.report.status.value != "PASS":
            self.logger.warning(
                "Qwen continuity pipeline requires review chapter=%s issues=%s",
                request.chapter_id,
                len(pipeline.report.issues),
            )

        states_by_scene: list[list[dict[str, object]]] = []
        for scene_index in range(len(pipeline.analysis.scenes)):
            scene_states: list[dict[str, object]] = []
            shard_keys = sorted(key for key in pipeline.continuity_states if key[0] == scene_index)
            for key in shard_keys:
                scene_states.extend(
                    state.model_dump(mode="json", by_alias=True)
                    for state in pipeline.continuity_states[key]
                )
            states_by_scene.append(scene_states)

        durable_result = pipeline.analysis.model_copy(
            update={
                "continuity_plan": pipeline.continuity_plan.model_dump(mode="json", by_alias=True),
                "continuity_states": states_by_scene,
                "continuity_report": pipeline.report.model_dump(mode="json", by_alias=True),
            }
        )
        durable_result = type(pipeline.analysis).model_validate(
            durable_result.model_dump(mode="json")
        )

        return ProviderOperation(
            provider_key="qwen-local",
            operation_id=pipeline.final_response_id,
            status=ProviderOperationStatus.COMPLETED,
            result=durable_result,
            usage=self._merge_usage(pipeline.usages),
        )

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        return operation

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        return operation
