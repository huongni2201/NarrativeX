import asyncio
import re
from decimal import Decimal
from unittest.mock import Mock, patch

import httpx
import pytest
from pydantic import ValidationError

from narrativex_worker.chapter_analysis_sharding import (
    ChapterStructureResult,
    SceneStructure,
    VisualBeatShardResult,
)
from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.ports import (
    ProviderBilling,
    ProviderPricingSnapshot,
    ProviderTokenUsage,
)
from narrativex_worker.providers.vertex import VertexGeminiProvider
from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ProviderOperationStatus,
    VisualBeatAnalysis,
)


def _billing(cost: str = "0.000001000") -> ProviderBilling:
    return ProviderBilling(
        actual_cost=Decimal(cost),
        currency="USD",
        usage=ProviderTokenUsage(prompt_tokens=10, candidate_tokens=5, total_tokens=15),
        pricing=ProviderPricingSnapshot(
            catalog_version="test",
            model_key="gemini-2.5-flash",
            location="us-central1",
            pricing_mode="STANDARD",
            input_usd_per_million=Decimal("0.15"),
            cached_input_usd_per_million=Decimal("0.0375"),
            output_usd_per_million=Decimal("0.60"),
        ),
    )


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


def _provider(*, shard_concurrency: int = 3) -> VertexGeminiProvider:
    settings = WorkerSettings(
        provider_mode="vertex",
        vertex_project_id="test-project",
        vertex_model="gemini-2.5-flash",
        vertex_analysis_shard_concurrency=shard_concurrency,
    )
    credentials = Mock(valid=True, token="token")
    with patch(
        "narrativex_worker.providers.vertex.google.auth.default",
        return_value=(credentials, None),
    ):
        return VertexGeminiProvider(settings)


def _one_scene_structure(start: str, end: str) -> ChapterStructureResult:
    return ChapterStructureResult(
        scenes=[
            SceneStructure(
                title="Scene",
                source_start_anchor=start,
                source_end_anchor=end,
            )
        ]
    )


def _target_beats_from_prompt(prompt: str) -> int:
    match = re.search(r"TARGET_VISUAL_BEATS=(\d+)", prompt)
    assert match is not None
    return int(match.group(1))


def _beats_for_prompt(prompt: str, *, anchor: str) -> VisualBeatShardResult:
    return VisualBeatShardResult(
        visual_beats=[
            VisualBeatAnalysis(
                title=f"beat-{index}",
                visual_intent="grounded",
                source_anchor=anchor,
            )
            for index in range(_target_beats_from_prompt(prompt))
        ]
    )


@pytest.mark.asyncio
async def test_submit_runs_shards_with_bounded_concurrency_and_merges_billing() -> None:
    source = "BEGIN_ALPHA " + ("alpha " * 1000).strip() + " END_ALPHA"
    provider = _provider(shard_concurrency=2)
    active = 0
    peak = 0
    calls = 0

    async def fake_generate(
        client: httpx.AsyncClient, token: str, prompt: str, model: type[object]
    ):
        nonlocal active, peak, calls
        del client, token
        calls += 1
        if model is ChapterStructureResult:
            return _one_scene_structure("BEGIN_ALPHA", "END_ALPHA"), _billing(), "structure"

        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.01)
        active -= 1
        assert "SHARD_SOURCE" in prompt
        anchor = "alpha" if "alpha" in prompt else "BEGIN_ALPHA"
        return _beats_for_prompt(prompt, anchor=anchor), _billing(), f"shard-{calls}"

    provider._generate_structured = fake_generate  # type: ignore[method-assign]
    operation = await provider.submit(_request(source))

    assert operation.status is ProviderOperationStatus.COMPLETED
    assert operation.result is not None
    assert operation.result.scenes[0].narration == source
    assert peak == 2
    assert operation.billing is not None
    assert operation.billing.actual_cost >= Decimal("0.000003000")


@pytest.mark.asyncio
async def test_provider_gate_bounds_analysis_calls_across_concurrent_jobs() -> None:
    source = "BEGIN_JOB " + ("word " * 100).strip() + " END_JOB"
    provider = _provider(shard_concurrency=1)
    active = 0
    peak = 0

    async def fake_generate(
        client: httpx.AsyncClient, token: str, prompt: str, model: type[object]
    ):
        nonlocal active, peak
        del client, token
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.01)
        active -= 1
        if model is ChapterStructureResult:
            return _one_scene_structure("BEGIN_JOB", "END_JOB"), _billing(), "structure"
        assert "SHARD_SOURCE" in prompt
        return _beats_for_prompt(prompt, anchor="word"), _billing(), "shard"

    provider._generate_structured = fake_generate  # type: ignore[method-assign]
    first, second = await asyncio.gather(
        provider.submit(_request(source)),
        provider.submit(_request(source)),
    )

    assert first.status is ProviderOperationStatus.COMPLETED
    assert second.status is ProviderOperationStatus.COMPLETED
    assert peak == 1


@pytest.mark.asyncio
async def test_under_dense_shard_gets_one_full_replacement_repair() -> None:
    source = "BEGIN_WORD " + ("word " * 100).strip() + " END_WORD"
    provider = _provider()
    shard_calls = 0

    async def fake_generate(
        client: httpx.AsyncClient, token: str, prompt: str, model: type[object]
    ):
        nonlocal shard_calls
        del client, token
        if model is ChapterStructureResult:
            return _one_scene_structure("BEGIN_WORD", "END_WORD"), _billing(), "structure"
        shard_calls += 1
        if shard_calls == 1:
            result = VisualBeatShardResult(
                visual_beats=[
                    VisualBeatAnalysis(
                        title="under-dense",
                        visual_intent="grounded",
                        source_anchor="word",
                    )
                ]
            )
        else:
            assert "COMPLETE replacement beat set" in prompt
            result = _beats_for_prompt(prompt, anchor="word")
        return result, _billing(), f"shard-{shard_calls}"

    provider._generate_structured = fake_generate  # type: ignore[method-assign]
    operation = await provider.submit(_request(source))

    assert shard_calls == 2
    assert operation.status is ProviderOperationStatus.COMPLETED


@pytest.mark.asyncio
async def test_invalid_structure_response_gets_one_full_replacement_repair() -> None:
    source = "BEGIN_WORD " + ("word " * 100).strip() + " END_WORD"
    provider = _provider()
    structure_calls = 0

    async def fake_generate(
        client: httpx.AsyncClient, token: str, prompt: str, model: type[object]
    ):
        nonlocal structure_calls
        del client, token
        if model is ChapterStructureResult:
            structure_calls += 1
            if structure_calls == 1:
                return None, _billing(), "invalid-structure"
            assert "repair pass" in prompt.lower()
            return (
                _one_scene_structure("BEGIN_WORD", "END_WORD"),
                _billing(),
                "repaired-structure",
            )
        return _beats_for_prompt(prompt, anchor="word"), _billing(), "shard"

    provider._generate_structured = fake_generate  # type: ignore[method-assign]
    operation = await provider.submit(_request(source))

    assert structure_calls == 2
    assert operation.status is ProviderOperationStatus.COMPLETED
    assert operation.billing is not None
    assert operation.billing.actual_cost >= Decimal("0.000003000")


def test_validation_reason_reports_path_and_type_without_raw_input() -> None:
    secret = "DO_NOT_LOG_THIS_STORY_TEXT"
    with pytest.raises(ValidationError) as captured:
        ChapterStructureResult.model_validate(
            {
                "scenes": [
                    {
                        "title": "Scene",
                        "source_start_anchor": "",
                        "source_end_anchor": secret,
                    }
                ]
            }
        )

    reason = VertexGeminiProvider._safe_validation_reason(captured.value)

    assert "scenes.0.source_start_anchor" in reason
    assert "string_too_short" in reason
    assert secret not in reason
