import inspect
import uuid
from unittest.mock import AsyncMock, Mock, patch

import pytest
from pydantic import BaseModel

from narrativex_worker.analysis_execution import ChapterAnalysisExecutionContext
from narrativex_worker.config import WorkerSettings
from narrativex_worker.continuity.pipeline_contracts import AnalysisStepIdentity
from narrativex_worker.providers.vertex import (
    VertexGeminiTransport,
    VertexSubmissionUnknownError,
)
from narrativex_worker.providers.vertex_continuity import (
    ContinuityVertexGeminiProvider,
    _VertexStructuredAdapter,
)
from narrativex_worker.repository.analysis_checkpoints import (
    AnalysisCheckpoint,
    AnalysisCheckpointStatus,
)
from narrativex_worker.schema import ChapterAnalysisRequest


def _settings() -> WorkerSettings:
    return WorkerSettings(
        provider_mode="vertex",
        vertex_project_id="test-project",
        vertex_model="gemini-2.5-flash",
    )


def _transport() -> VertexGeminiTransport:
    credentials = Mock(valid=True, token="token")
    with patch(
        "narrativex_worker.providers.vertex.google.auth.default",
        return_value=(credentials, None),
    ):
        return VertexGeminiTransport(_settings())


def _provider() -> ContinuityVertexGeminiProvider:
    credentials = Mock(valid=True, token="token")
    with patch(
        "narrativex_worker.providers.vertex.google.auth.default",
        return_value=(credentials, None),
    ):
        return ContinuityVertexGeminiProvider(_settings())


def _request() -> ChapterAnalysisRequest:
    return ChapterAnalysisRequest(
        project_id="00000000-0000-4000-8000-000000000001",
        story_version_id="00000000-0000-4000-8000-000000000002",
        chapter_id="00000000-0000-4000-8000-000000000003",
        chapter_row_version=0,
        source_hash="0" * 64,
        source_text="chapter source",
        source_language="vi-VN",
    )


class _TinyResult(BaseModel):
    value: str


class _CheckpointStub:
    def __init__(self, status: AnalysisCheckpointStatus) -> None:
        self.status = status
        self.stage_attempt_id = uuid.uuid4()
        self.begin_calls = 0

    async def claim(self, **kwargs: object) -> AnalysisCheckpoint:
        del kwargs
        return AnalysisCheckpoint(
            id=uuid.uuid4(),
            generation_job_id=uuid.uuid4(),
            stage_attempt_id=self.stage_attempt_id,
            step_key="structure",
            input_fingerprint="a" * 64,
            claim_owner="worker",
            lease_version=2,
            status=self.status,
            result_json=(
                {"responseId": "durable-response", "result": {"value": "replayed"}}
                if self.status is AnalysisCheckpointStatus.COMPLETED
                else None
            ),
            result_hash="b" * 64 if self.status is AnalysisCheckpointStatus.COMPLETED else None,
            provider_operation_id=uuid.uuid4(),
        )

    async def begin_provider_call(self, *args: object, **kwargs: object) -> AnalysisCheckpoint:
        del args, kwargs
        self.begin_calls += 1
        raise AssertionError("durable terminal checkpoint must not cross the provider fence")


def test_vertex_structured_adapter_accepts_keyword_only_identity() -> None:
    parameters = inspect.signature(_VertexStructuredAdapter.generate).parameters

    assert "identity" in parameters
    assert parameters["identity"].kind is inspect.Parameter.KEYWORD_ONLY
    assert parameters["identity"].default is None


def test_vertex_transport_does_not_expose_provider_submit() -> None:
    assert not hasattr(_transport(), "submit")


def test_continuity_provider_owns_story_analysis_capability() -> None:
    capabilities = _provider().get_capabilities()

    assert capabilities.provider_key == "vertex"
    assert capabilities.supports_story_analysis is True


def test_vertex_diagnostic_does_not_include_exception_message() -> None:
    reason = VertexGeminiTransport._safe_exception_reason(
        ValueError("SECRET_STORY_FRAGMENT must not enter logs")
    )

    assert reason == "ValueError"
    assert "SECRET_STORY_FRAGMENT" not in reason


@pytest.mark.asyncio
async def test_completed_checkpoint_replays_without_resubmitting_vertex() -> None:
    checkpoints = _CheckpointStub(AnalysisCheckpointStatus.COMPLETED)
    transport = _transport()
    transport._bounded_generate_structured = AsyncMock(  # type: ignore[method-assign]
        side_effect=AssertionError("Vertex transport must not be called for durable replay")
    )
    execution = ChapterAnalysisExecutionContext(
        stage_attempt_id=checkpoints.stage_attempt_id,
        claim_owner="worker",
        checkpoints=checkpoints,  # type: ignore[arg-type]
    )
    adapter = _VertexStructuredAdapter(
        transport,
        Mock(),
        "token",
        request=_request(),
        execution=execution,
    )

    result, billing, response_id = await adapter.generate(
        "prompt",
        _TinyResult,
        identity=AnalysisStepIdentity(
            step_key="structure",
            owned_source_range={"start": 0, "end": 14, "source": "chapter source"},
        ),
    )

    assert result == _TinyResult(value="replayed")
    assert response_id == "durable-response"
    assert billing.actual_cost == 0
    assert adapter.reused_subcalls == 1
    assert checkpoints.begin_calls == 0
    transport._bounded_generate_structured.assert_not_awaited()


@pytest.mark.asyncio
async def test_unknown_checkpoint_refuses_blind_vertex_resubmission() -> None:
    checkpoints = _CheckpointStub(AnalysisCheckpointStatus.UNKNOWN)
    transport = _transport()
    transport._bounded_generate_structured = AsyncMock(  # type: ignore[method-assign]
        side_effect=AssertionError("Vertex transport must not be called for UNKNOWN checkpoint")
    )
    execution = ChapterAnalysisExecutionContext(
        stage_attempt_id=checkpoints.stage_attempt_id,
        claim_owner="worker",
        checkpoints=checkpoints,  # type: ignore[arg-type]
    )
    adapter = _VertexStructuredAdapter(
        transport,
        Mock(),
        "token",
        request=_request(),
        execution=execution,
    )

    with pytest.raises(VertexSubmissionUnknownError, match="refusing blind resubmission"):
        await adapter.generate(
            "prompt",
            _TinyResult,
            identity=AnalysisStepIdentity(
                step_key="structure",
                owned_source_range={"start": 0, "end": 14, "source": "chapter source"},
            ),
        )

    assert checkpoints.begin_calls == 0
    transport._bounded_generate_structured.assert_not_awaited()
