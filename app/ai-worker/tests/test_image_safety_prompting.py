from narrativex_worker.prompting import build_chapter_analysis_prompt
from narrativex_worker.schema import ChapterAnalysisRequest


def test_image_visual_beats_use_provider_safe_non_graphic_language() -> None:
    request = ChapterAnalysisRequest(
        project_id="00000000-0000-4000-8000-000000000001",
        story_version_id="00000000-0000-4000-8000-000000000002",
        chapter_id="00000000-0000-4000-8000-000000000003",
        chapter_row_version=0,
        source_hash="0" * 64,
        source_text="Một cảnh căng thẳng trong truyện.",
        source_language="vi-VN",
        visual_generation_mode="IMAGE",
        image_provider="GEMINI_WEB",
    )

    prompt = build_chapter_analysis_prompt(request)

    assert "IMAGE-SAFETY ADAPTATION" in prompt
    assert "non-graphic" in prompt
    assert "appropriately clothed" in prompt
    assert "indirect visual language" in prompt
    assert "Preserve the narrative fact" in prompt
    assert "explicit physical or coercive mechanics" in prompt
