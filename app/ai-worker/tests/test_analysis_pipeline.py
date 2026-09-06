import hashlib
from decimal import Decimal

import pytest

from narrativex_worker.analysis_pipeline import (
    ChapterStructureWithContinuityResult,
    VisualBeatShardWithContinuityResult,
    run_chapter_analysis_pipeline,
)
from narrativex_worker.continuity.pipeline_contracts import AnalysisStepIdentity
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


def _request(source: str) -> ChapterAnalysisRequest:
    return ChapterAnalysisRequest(
        project_id="00000000-0000-4000-8000-000000000001",
        story_version_id="00000000-0000-4000-8000-000000000002",
        chapter_id="00000000-0000-4000-8000-000000000003",
        chapter_row_version=0,
        source_hash=hashlib.sha256(source.encode("utf-8")).hexdigest(),
        source_text=source,
        source_language="vi-VN",
    )


class FakeStructuredAdapter:
    def __init__(self, *, conflicting_shard_attempts: int = 0) -> None:
        self.prompts: list[str] = []
        self.identities: list[AnalysisStepIdentity | None] = []
        self.conflicting_shard_attempts = conflicting_shard_attempts
        self.shard_calls = 0

    async def generate(  # type: ignore[no-untyped-def]
        self, prompt: str, model, *, identity: AnalysisStepIdentity | None = None
    ):
        self.prompts.append(prompt)
        self.identities.append(identity)
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
            payload["continuityPlan"]["sourceHash"] = prompt.split("SOURCE_HASH=", 1)[1].split(
                "\n", 1
            )[0]
            return model.model_validate(payload), _billing(), "structure-1"

        assert model is VisualBeatShardWithContinuityResult
        self.shard_calls += 1
        visible_value = "hand" if self.shard_calls <= self.conflicting_shard_attempts else "table"
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
                                    "value": visible_value,
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
            f"shard-{self.shard_calls}",
        )


@pytest.mark.asyncio
async def test_pipeline_builds_continuity_before_parallel_shards_and_returns_pass_report() -> None:
    source = "Lan đặt kiếm lên bàn."
    adapter = FakeStructuredAdapter()
    request = _request(source)

    result = await run_chapter_analysis_pipeline(
        request=request,
        adapter=adapter,
        target_beats=1,
        max_beats=2,
        repair_attempts=1,
        planning_duration_ms=5_000,
    )

    # Every provider call is independent: shard and repair prompts must carry the
    # fact contract themselves instead of relying on the structure call's context.
    for prompt in adapter.prompts:
        assert "SOURCE requires value!=null, evidenceAnchor!=null, canonVersionId=null" in prompt
        assert "UNKNOWN requires value=null, evidenceAnchor=null, canonVersionId=null" in prompt
        assert "APPROVED_CANON requires value!=null and canonVersionId!=null" in prompt
    assert "continuityStates:[{beatKey,entryFacts:" in adapter.prompts[1]
    assert "exactly one continuity state per visual beat, in the same order" in adapter.prompts[1]

    assert result.report.status.value == "PASS"
    assert result.continuity_plan.source_hash == request.source_hash
    assert result.analysis.scenes[0].visual_beats[0].source_anchor == source
    assert "CONTINUITY_CONTEXT=" in adapter.prompts[1]
    assert "READ_ONLY_CONTEXT" in adapter.prompts[1]
    assert adapter.identities[0] is not None
    assert adapter.identities[0].step_key == "structure"
    assert adapter.identities[1] is not None
    assert adapter.identities[1].step_key == "shard:0:0"


@pytest.mark.asyncio
async def test_blocking_continuity_conflict_triggers_bounded_repair_and_can_recover() -> None:
    adapter = FakeStructuredAdapter(conflicting_shard_attempts=1)

    result = await run_chapter_analysis_pipeline(
        request=_request("Lan đặt kiếm lên bàn."),
        adapter=adapter,
        target_beats=1,
        max_beats=2,
        repair_attempts=1,
        planning_duration_ms=5_000,
    )

    assert result.report.status.value == "PASS"
    assert adapter.shard_calls == 2
    assert adapter.identities[2] is not None
    assert adapter.identities[2].step_key == "repair:0:0:1"
    assert "UNSUPPORTED_STATE_CHANGE" in adapter.prompts[2]
    assert (
        "SOURCE requires value!=null, evidenceAnchor!=null, canonVersionId=null"
        in (adapter.prompts[2])
    )
    assert "continuityStates:[{beatKey,entryFacts:" in adapter.prompts[2]
    assert all(
        identity.prompt_version == "continuity-v2"
        for identity in adapter.identities
        if identity is not None
    )


@pytest.mark.asyncio
async def test_exhausted_continuity_repair_preserves_reviewable_result() -> None:
    adapter = FakeStructuredAdapter(conflicting_shard_attempts=99)

    result = await run_chapter_analysis_pipeline(
        request=_request("Lan đặt kiếm lên bàn."),
        adapter=adapter,
        target_beats=1,
        max_beats=2,
        repair_attempts=1,
        planning_duration_ms=5_000,
    )

    assert result.report.status.value == "NEEDS_REVIEW"
    assert adapter.shard_calls == 2
    assert {issue.code for issue in result.report.issues} == {"UNSUPPORTED_STATE_CHANGE"}
    assert result.analysis.scenes[0].visual_beats[0].source_anchor == "Lan đặt kiếm lên bàn."
