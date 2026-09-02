from narrativex_worker.chapter_analysis_prompts import (
    build_chapter_structure_prompt,
    build_visual_beat_shard_prompt,
)
from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    SceneStructure,
    VisualBeatShard,
)
from narrativex_worker.schema import ChapterAnalysisRequest, CharacterAnalysis


def _request(source: str) -> ChapterAnalysisRequest:
    return ChapterAnalysisRequest(
        project_id="00000000-0000-4000-8000-000000000001",
        story_version_id="00000000-0000-4000-8000-000000000002",
        chapter_id="00000000-0000-4000-8000-000000000003",
        chapter_row_version=0,
        source_hash="0" * 64,
        source_text=source,
        source_language="vi-VN",
    )


def test_structure_prompt_explicitly_defers_visual_beats() -> None:
    prompt = build_chapter_structure_prompt(_request("full chapter text"))

    assert "Do NOT create visual beats in this phase" in prompt
    assert "source_anchor" in prompt
    assert "full chapter text" in prompt


def test_shard_prompt_contains_only_shard_source_not_full_chapter() -> None:
    request = _request("prefix SECRET_FULL_CHAPTER suffix")
    structure = ChapterStructureResult(
        characters=[CharacterAnalysis(key="lead", name="Lead")],
        scenes=[
            SceneStructure(
                title="Scene",
                narration="prefix",
                source_anchor="prefix",
                characters=[{"character_key": "lead"}],
            )
        ],
    )
    shard = VisualBeatShard(
        scene_index=0,
        shard_index=0,
        source_start=0,
        source_end=6,
        source_text="prefix",
        minimum_beats=1,
        target_beats=1,
        maximum_beats=1,
    )

    prompt = build_visual_beat_shard_prompt(request, structure, shard)

    assert "prefix" in prompt
    assert "SECRET_FULL_CHAPTER" not in prompt
    assert "MIN_VISUAL_BEATS=1" in prompt
    assert "Every beat requires source_anchor" in prompt
