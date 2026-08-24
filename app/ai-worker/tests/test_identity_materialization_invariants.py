"""Regression tests for AI character materialization invariants."""

from types import SimpleNamespace
from uuid import UUID

import pytest

from narrativex_worker.materialization.identity import _create_character


CHARACTER_ID = UUID("00000000-0000-7000-8000-000000000101")
PROJECT_CHARACTER_ID = UUID("00000000-0000-7000-8000-000000000102")
PROJECT_ID = UUID("00000000-0000-7000-8000-000000000103")


class _Connection:
    def __init__(self) -> None:
        self.fetchval_calls: list[tuple[str, tuple[object, ...]]] = []
        self.execute_calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetchval(self, query: str, *args: object) -> UUID:
        self.fetchval_calls.append((query, args))
        if "INSERT INTO characters" in query:
            return CHARACTER_ID
        if "INSERT INTO project_characters" in query:
            return PROJECT_CHARACTER_ID
        raise AssertionError(f"unexpected fetchval query: {query}")

    async def execute(self, query: str, *args: object) -> str:
        self.execute_calls.append((query, args))
        return "INSERT 0 1"


@pytest.mark.asyncio
async def test_ai_created_draft_version_is_not_pinned_to_project_character() -> None:
    connection = _Connection()
    claimed = SimpleNamespace(
        requested_by_user_id="owner-1",
        request=SimpleNamespace(project_id=PROJECT_ID),
    )

    result = await _create_character(
        connection,  # type: ignore[arg-type]
        claimed,  # type: ignore[arg-type]
        "Mina",
        ["Min"],
        "A draft AI character description",
    )

    assert result == PROJECT_CHARACTER_ID
    version_query, version_args = connection.execute_calls[0]
    assert "INSERT INTO character_versions" in version_query
    assert "'DRAFT'" in version_query
    assert version_args == (CHARACTER_ID, "A draft AI character description")

    project_query, project_args = next(
        (query, args)
        for query, args in connection.fetchval_calls
        if "INSERT INTO project_characters" in query
    )
    assert "pinned_character_version_id" not in project_query
    assert project_args == (
        PROJECT_ID,
        CHARACTER_ID,
        "A draft AI character description",
    )
