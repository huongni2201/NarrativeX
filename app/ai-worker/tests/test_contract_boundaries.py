"""Regression tests for public worker contract boundaries."""

import pytest
from pydantic import ValidationError

from narrativex_worker.repository import WorkerRepository as PublicWorkerRepository
from narrativex_worker.repository.claims import (
    WorkerRepository as ClaimsWorkerRepository,
)
from narrativex_worker.schema import ChapterAnalysisRequest

SOURCE_HASH = "a" * 64


def chapter_request(source_text: str) -> ChapterAnalysisRequest:
    return ChapterAnalysisRequest(
        project_id="00000000-0000-4000-8000-000000000001",
        story_version_id="00000000-0000-4000-8000-000000000002",
        chapter_id="00000000-0000-4000-8000-000000000003",
        chapter_row_version=1,
        source_hash=SOURCE_HASH,
        source_text=source_text,
    )


def test_source_text_accepts_declared_character_limit() -> None:
    request = chapter_request("đ" * 500_000)

    assert len(request.source_text) == 500_000


def test_source_text_rejects_over_declared_character_limit() -> None:
    with pytest.raises(ValidationError):
        chapter_request("đ" * 500_001)


def test_claims_seam_exports_public_repository_facade() -> None:
    assert ClaimsWorkerRepository is PublicWorkerRepository
