"""Regression tests for AI-generated character profile materialization."""

import json
from uuid import UUID

import pytest

from narrativex_worker.materialization.identity import _materialize_character_profile
from narrativex_worker.schema import CharacterAnalysis

PROJECT_ID = UUID("00000000-0000-4000-8000-000000000001")
CHAPTER_ID = UUID("00000000-0000-4000-8000-000000000002")
PROJECT_CHARACTER_ID = UUID("00000000-0000-4000-8000-000000000003")
CHARACTER_ID = UUID("00000000-0000-4000-8000-000000000004")
VERSION_ID = UUID("00000000-0000-4000-8000-000000000005")
PINNED_VERSION_ID = UUID("00000000-0000-4000-8000-000000000006")


def enriched_character() -> CharacterAnalysis:
    return CharacterAnalysis(
        key="lam-van-van",
        name="Lâm Vân Vân",
        aliases=["Đệ nhất mỹ nhân Giang Thành"],
        description="Một nhân vật có ảnh hưởng lớn tới diễn biến hiện tại.",
        role="LEAD",
        importance=90,
        groups=["Lâm gia"],
        bible="Thông minh, điềm tĩnh, có địa vị cao trong Giang Thành.",
        visual_prompt="Nữ nhân trẻ, khí chất thanh lãnh, dung mạo nổi bật.",
        age_state="Trẻ trưởng thành",
        hairstyle="Tóc đen dài được búi gọn.",
        injury="Không có thương tích được nhắc tới.",
        wardrobe_context="Trang phục trang nhã phù hợp địa vị.",
        appearance_prompt=(
            "Nữ nhân trẻ với tóc đen dài, phong thái thanh lãnh, trang phục trang nhã."
        ),
    )


class ProfileConnection:
    def __init__(self, *, pinned_version_id: UUID | None = None) -> None:
        self.pinned_version_id = pinned_version_id
        self.execute_calls: list[tuple[str, tuple[object, ...]]] = []
        self.fetchval_calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
        assert "FROM project_characters" in query
        assert args == (PROJECT_ID, PROJECT_CHARACTER_ID)
        return {
            "character_id": CHARACTER_ID,
            "pinned_character_version_id": self.pinned_version_id,
            "role": "SUPPORTING",
            "importance": 0,
            "groups_json": "[]",
        }

    async def fetchval(self, query: str, *args: object) -> object:
        self.fetchval_calls.append((query, args))
        if "MAX(version_number)" in query:
            assert args == (CHARACTER_ID,)
            return 1
        if "INSERT INTO character_versions" in query:
            return VERSION_ID
        if "FROM character_appearances" in query:
            assert args == (CHARACTER_ID, PROJECT_ID, f"chapter:{CHAPTER_ID}")
            return None
        raise AssertionError(f"Unexpected fetchval query: {query}")

    async def execute(self, query: str, *args: object) -> str:
        self.execute_calls.append((query, args))
        return "UPDATE 1"


@pytest.mark.asyncio
async def test_unpinned_character_gets_profile_version_pin_and_timeline_appearance() -> None:
    connection = ProfileConnection()
    character = enriched_character()

    await _materialize_character_profile(
        connection,
        PROJECT_ID,
        CHAPTER_ID,
        PROJECT_CHARACTER_ID,
        character,
    )

    project_update = next(
        call for call in connection.execute_calls if "SET role = $3" in call[0]
    )
    assert project_update[1][2] == "LEAD"
    assert project_update[1][3] == 90
    assert json.loads(str(project_update[1][4])) == ["Lâm gia"]

    version_insert = next(
        call for call in connection.fetchval_calls if "INSERT INTO character_versions" in call[0]
    )
    assert version_insert[1] == (
        CHARACTER_ID,
        1,
        character.bible,
        character.visual_prompt,
    )

    pin_update = next(
        call for call in connection.execute_calls if "pinned_character_version_id = $3" in call[0]
    )
    assert pin_update[1] == (PROJECT_ID, PROJECT_CHARACTER_ID, VERSION_ID)

    appearance_insert = next(
        call for call in connection.execute_calls if "INSERT INTO character_appearances" in call[0]
    )
    assert appearance_insert[1][0:3] == (
        CHARACTER_ID,
        PROJECT_ID,
        f"chapter:{CHAPTER_ID}",
    )
    assert appearance_insert[1][3:] == (
        character.age_state,
        character.hairstyle,
        character.injury,
        character.wardrobe_context,
        character.appearance_prompt,
    )


@pytest.mark.asyncio
async def test_explicitly_pinned_character_version_is_not_replaced() -> None:
    connection = ProfileConnection(pinned_version_id=PINNED_VERSION_ID)
    character = enriched_character().model_copy(
        update={
            "age_state": "",
            "hairstyle": "",
            "injury": "",
            "wardrobe_context": "",
            "appearance_prompt": "",
        }
    )

    await _materialize_character_profile(
        connection,
        PROJECT_ID,
        CHAPTER_ID,
        PROJECT_CHARACTER_ID,
        character,
    )

    assert all("character_versions" not in query for query, _ in connection.fetchval_calls)
    assert all("character_appearances" not in query for query, _ in connection.fetchval_calls)
    assert all(
        "pinned_character_version_id = $3" not in query for query, _ in connection.execute_calls
    )


def test_legacy_character_analysis_payload_remains_compatible() -> None:
    character = CharacterAnalysis.model_validate(
        {
            "key": "legacy",
            "name": "Legacy Character",
            "aliases": [],
            "description": "Old provider payload",
        }
    )

    assert character.role == "SUPPORTING"
    assert character.importance == 0
    assert character.groups == []
    assert character.bible == ""
    assert character.appearance_prompt == ""
