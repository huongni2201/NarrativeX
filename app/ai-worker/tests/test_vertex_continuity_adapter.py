import inspect
from unittest.mock import Mock, patch

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.vertex import VertexGeminiProvider, VertexProviderError
from narrativex_worker.providers.vertex_continuity import _VertexStructuredAdapter
from narrativex_worker.schema import ChapterAnalysisRequest


def _legacy_transport() -> VertexGeminiProvider:
    settings = WorkerSettings(
        provider_mode="vertex",
        vertex_project_id="test-project",
        vertex_model="gemini-2.5-flash",
    )
    credentials = Mock(valid=True, token="token")
    with patch(
        "narrativex_worker.providers.vertex.google.auth.default",
        return_value=(credentials, None),
    ):
        return VertexGeminiProvider(settings)


def _request() -> ChapterAnalysisRequest:
    return ChapterAnalysisRequest(
        project_id="00000000-0000-4000-8000-000000000001",
        story_version_id="00000000-0000-4000-8000-000000000002",
        chapter_id="00000000-0000-4000-8000-000000000003",
        chapter_row_version=0,
        source_hash="0" * 64,
        source_text="story",
        source_language="vi-VN",
    )


def test_vertex_structured_adapter_accepts_keyword_only_identity() -> None:
    parameters = inspect.signature(_VertexStructuredAdapter.generate).parameters

    assert "identity" in parameters
    assert parameters["identity"].kind is inspect.Parameter.KEYWORD_ONLY
    assert parameters["identity"].default is None


@pytest.mark.asyncio
async def test_direct_vertex_submit_is_retired() -> None:
    with pytest.raises(VertexProviderError, match="retired"):
        await _legacy_transport().submit(_request())


def test_vertex_diagnostic_does_not_include_exception_message() -> None:
    reason = VertexGeminiProvider._safe_exception_reason(
        ValueError("SECRET_STORY_FRAGMENT must not enter logs")
    )

    assert reason == "ValueError"
    assert "SECRET_STORY_FRAGMENT" not in reason
