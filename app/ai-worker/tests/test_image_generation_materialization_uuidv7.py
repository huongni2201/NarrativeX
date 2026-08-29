from __future__ import annotations

from typing import Any
from uuid import UUID

import pytest

from narrativex_worker.image_generation_repository.materialization import ImageMaterializationMixin
from narrativex_worker.media_repository import DurableMediaResult
from narrativex_worker.providers.image import ImageGenerationResult
from narrativex_worker.schema import ModerationDecision


PROJECT_ID = UUID("018f0000-0000-7000-8000-000000000005")


class _Transaction:
    async def __aenter__(self) -> _Transaction:
        return self

    async def __aexit__(self, exception_type: object, exception: object, traceback: object) -> None:
        return None


class _Connection:
    def __init__(self) -> None:
        self.execute_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.fetchrow_queries: list[str] = []

    def transaction(self) -> _Transaction:
        return _Transaction()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        self.fetchrow_queries.append(query)
        if "SELECT mgi.id" in query:
            return {
                "id": UUID("018f0000-0000-7000-8000-000000000001"),
                "execution_status": "RUNNING",
                "media_asset_id": None,
                "request_fingerprint": "f" * 64,
                "visual_beat_id": UUID("018f0000-0000-7000-8000-000000000002"),
                "generation_job_id": UUID("018f0000-0000-7000-8000-000000000003"),
                "media_plan_id": UUID("018f0000-0000-7000-8000-000000000004"),
                "project_id": PROJECT_ID,
                "requested_by_user_id": "user-1",
                "chapter_id": UUID("018f0000-0000-7000-8000-000000000006"),
            }
        raise AssertionError(f"Unexpected fetchrow query: {query}")

    async def execute(self, query: str, *args: Any) -> str:
        self.execute_calls.append((query, args))
        return "INSERT 0 1" if "INSERT INTO" in query else "UPDATE 1"


class _Acquire:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    async def __aenter__(self) -> _Connection:
        return self.connection

    async def __aexit__(self, exception_type: object, exception: object, traceback: object) -> None:
        return None


class _Pool:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def acquire(self) -> _Acquire:
        return _Acquire(self.connection)


class _Repository(ImageMaterializationMixin):
    def __init__(self, connection: _Connection) -> None:
        self.pool = _Pool(connection)

    def _require_pool(self) -> _Pool:
        return self.pool


@pytest.mark.asyncio
async def test_new_image_asset_is_project_scoped_without_account_wide_checksum_reuse() -> None:
    connection = _Connection()
    repository = _Repository(connection)
    stored = DurableMediaResult(
        storage_key="generated/project/chapter/beat-1.png",
        checksum="a" * 64,
        mime_type="image/png",
        width=1280,
        height=720,
        item_key="beat-1",
    )
    provider_result = ImageGenerationResult(
        mime_type="image/png",
        content=b"image-bytes",
        width=1280,
        height=720,
        moderation=ModerationDecision.SAFE,
        result_fingerprint="b" * 64,
    )

    await repository.finalize_image_result(
        operation_id=None,
        item_key="beat-1",
        request_fingerprint="f" * 64,
        provider_operation_id="provider-op-1",
        provider_result=provider_result,
        stored=stored,
    )

    media_asset_insert = next(
        call for call in connection.execute_calls if "INSERT INTO media_assets" in call[0]
    )
    lineage_insert = next(
        call for call in connection.execute_calls if "INSERT INTO media_asset_lineage" in call[0]
    )

    media_asset_id = media_asset_insert[1][0]
    lineage_id = lineage_insert[1][0]
    assert isinstance(media_asset_id, UUID)
    assert isinstance(lineage_id, UUID)
    assert media_asset_id.version == 7
    assert lineage_id.version == 7
    assert lineage_insert[1][1] == media_asset_id

    normalized_insert = " ".join(media_asset_insert[0].split())
    assert "project_id" in normalized_insert
    assert "storage_mode" in normalized_insert
    assert "'PROJECT_LOCAL'" in normalized_insert
    assert PROJECT_ID in media_asset_insert[1]
    assert all("media_asset_checksums" not in query for query in connection.fetchrow_queries)
    assert all(
        "INSERT INTO media_asset_checksums" not in query
        for query, _args in connection.execute_calls
    )
