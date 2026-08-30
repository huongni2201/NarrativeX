from narrativex_worker.prompting import build_chapter_analysis_prompt
from narrativex_worker.schema import ChapterAnalysisRequest


def _request() -> ChapterAnalysisRequest:
    return ChapterAnalysisRequest(
        project_id="00000000-0000-4000-8000-000000000001",
        story_version_id="00000000-0000-4000-8000-000000000002",
        chapter_id="00000000-0000-4000-8000-000000000003",
        chapter_row_version=0,
        source_hash="0" * 64,
        source_text="Anh mở cửa. Anh bước vào phòng.",
        source_language="vi-VN",
        visual_generation_mode="IMAGE",
        image_provider="API",
    )


def test_visual_beat_prompt_requires_verbatim_source_anchor_without_timestamps() -> None:
    prompt = build_chapter_analysis_prompt(_request())

    assert "source_anchor" in prompt
    assert "verbatim contiguous excerpt" in prompt
    assert "Never invent timestamps" in prompt
    assert "Never invent character offsets" in prompt
    assert "visual_beats:[{title,visual_intent,source_anchor,camera_angle," in prompt
