from decimal import Decimal

import pytest

from narrativex_worker.analysis_pipeline import (
    ChapterStructureWithContinuityResult,
    VisualBeatShardWithContinuityResult,
    run_chapter_analysis_pipeline,
)
from narrativex_worker.providers.ports import (
    ProviderBilling,
    ProviderPricingSnapshot,
    ProviderTokenUsage,
)
from narrativex_worker.schema import ChapterAnalysisRequest


def _billing() -> ProviderBilling:
    return ProviderBilling(
        actual_cost=Decimal("0"),
        currency="USD",
        usage=ProviderTokenUsage(prompt_tokens=0, candidate_tokens=0),
        pricing=ProviderPricingSnapshot(
            catalog_version="test",
            model_key="fake",
            location="test",
            pricing_mode="test",
            input_usd_per_million=Decimal("0"),
            cached_input_usd_per_million=Decimal("0"),
            output_usd_per_million=Decimal("0"),
        ),
    )


class FakeStructuredAdapter:
    def __init__(self) -> None:
        self.prompts: list[str] = []

    async def generate(self, prompt: str, model):  # type: ignore[no-untyped-def]
        self.prompts.append(prompt)
        if model is ChapterStructureWithContinuityResult:
            payload = {
                "characters": [{"key": "lan", "name": "Lan"}],
                "locations": [],
                "scenes": [
                    {
                        "title": "Room",
                        "source_start_anchor": "Lan đặt kiếm lên bàn.",
                        "source_end_anchor": "Lan đặt kiếm lên bàn.",
                        "characters": [{"character_key": "lan"}],
                    }
                ],
                "continuityPlan": {
                    "schemaVersion": 1,
                    "sourceHash": "SOURCE_HASH",
                    "summary": "",
                    "events": [
                        {
                            "key": "sword_on_table",
                            "sourceAnchor": "Lan đặt kiếm lên bàn.",
                            "timelineKey": "present",
                            "changes": [
                                {
                                    "subjectKey": "sword",
                                    "predicate": "prop_position",
                                    "value": "table",
                                    "provenance": "SOURCE",
                                    "evidenceAnchor": "Lan đặt kiếm lên bàn.",
                                    "canonVersionId": None,
                                }
                            ],
                        }
                    ],
                    "sceneStates": [
                        {
                            "sceneKey": "room",
                            "timelineKey": "present",
                            "entryFacts": [],
                            "exitFacts": [],
                            "eventKeys": ["sword_on_table"],
                        }
                    ],
                    "visualStyleConstraints": [],
                },
            }
            payload["continuityPlan"]["sourceHash"] = prompt.split("SOURCE_HASH=", 1)[1].split("\n", 1)[0]
            return model.model_validate(payload), _billing(), "structure-1"

        assert model is VisualBeatShardWithContinuityResult
        return (
            model.model_validate(
                {
                    "visual_beats": [
                        {
                            "title": "Sword on table",
                            "visual_intent": "Lan has just placed the sword on the table.",
                            "source_anchor": "Lan đặt kiếm lên bàn.",
                            "visual_direction": {
                                "shot_size": "MEDIUM",
                                "camera_angle": "EYE_LEVEL",
                                "lens_mm": 50,
                                "focus_target": "the sword on the table",
                                "action_phase": "AFTER",
                                "subject_placement": "Lan and table in center third",
                                "foreground": None,
                                "background": "quiet room",
                                "motivated_light": "window light",
                                "palette": "neutral",
                                "camera_movement": "NONE",
                                "movement_direction": None,
                                "movement_intensity": "SUBTLE",
                                "crop_safe_area": "safe on all sides",
                            },
                            "characters": [{"character_key": "lan", "role": "PRIMARY"}],
                        }
                    ],
                    "continuityStates": [
                        {
                            "beatKey": "sword_after",
                            "entryFacts": [],
                            "visibleFacts": [
                                {
                                    "subjectKey": "sword",
                                    "predicate": "prop_position",
                                    "value": "table",
                                    "provenance": "SOURCE",
                                    "evidenceAnchor": "Lan đặt kiếm lên bàn.",
                                    "canonVersionId": None,
                                }
                            ],
                            "exitFacts": [],
                            "eventKeys": ["sword_on_table"],
                        }
                    ],
                }
            ),
            _billing(),
            "shard-1",
        )


@pytest.mark.asyncio
async def test_pipeline_builds_continuity_before_parallel_shards_and_returns_pass_report() -> None:
    source = "Lan đặt kiếm lên bàn."
    import hashlib

    adapter = FakeStructuredAdapter()
    request = ChapterAnalysisRequest(
        project_id="00000000-0000-4000-8000-000000000001",
        story_version_id="00000000-0000-4000-8000-000000000002",
        chapter_id="00000000-0000-4000-8000-000000000003",
        chapter_row_version=0,
        source_hash=hashlib.sha256(source.encode("utf-8")).hexdigest(),
        source_text=source,
        source_language="vi-VN",
    )

    result = await run_chapter_analysis_pipeline(
        request=request,
        adapter=adapter,
        target_beats=1,
        max_beats=2,
        repair_attempts=1,
        planning_duration_ms=5_000,
    )

    assert result.report.status.value == "PASS"
    assert result.continuity_plan.source_hash == request.source_hash
    assert result.analysis.scenes[0].visual_beats[0].source_anchor == source
    assert "CONTINUITY_CONTEXT=" in adapter.prompts[1]
    assert "READ_ONLY_CONTEXT" in adapter.prompts[1]
