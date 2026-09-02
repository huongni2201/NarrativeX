import asyncio
from decimal import Decimal
from unittest.mock import Mock, patch

import pytest

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


@pytest.mark.asyncio
async def test_submit_runs_shards_with_bounded_concurrency_and_merges_billing() -> None:
    source = "BEGIN_ALPHA " + ("alpha " * 1000).strip() + " END_ALPHA"
    provider = _provider(shard_concurrency=2)
    active = 0
    peak = 0
    calls = 0

    async def fake_generate(token: str, prompt: str, model: type[object]):
        nonlocal active, peak, calls
        del token
        calls += 1
        if model is ChapterStructureResult:
            return (
                ChapterStructureResult(
                    scenes=[
                        SceneStructure(
                            title="Scene",
                            source_start_anchor="BEGIN_ALPHA",
                            source_end_anchor="END_ALPHA",
                        )
                    ]
                ),
                _billing(),
                "structure",
            )

        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.01)
        active -= 1
        assert "SHARD_SOURCE" in prompt
        anchor = "alpha" if "alpha" in prompt else "BEGIN_ALPHA"
        return (
            VisualBeatShardResult(
                visual_beats=[
                    VisualBeatAnalysis(
                        title="beat",
                        visual_intent="grounded",
                        source_anchor=anchor,
                    )
                    for _ in range(12)
                ]
            ),
            _billing(),
            f"shard-{calls}",
        )

    provider._generate_structured = fake_generate  # type: ignore[method-assign]
    operation = await provider.submit(_request(source))

    assert operation.status is ProviderOperationStatus.COMPLETED
    assert operation.result is not None
    assert operation.result.scenes[0].narration == source
    assert peak == 2
    assert operation.billing is not None
    assert operation.billing.actual_cost >= Decimal("0.000005000")


@pytest.mark.asyncio
async def test_under_dense_shard_gets_one_full_replacement_repair() -> None:
    source = "BEGIN_WORD " + ("word " * 100).strip() + " END_WORD"
    provider = _provider()
    shard_calls = 0

    async def fake_generate(token: str, prompt: str, model: type[object]):
        nonlocal shard_calls
        del token
        if model is ChapterStructureResult:
            return (
                ChapterStructureResult(
                    scenes=[
                        SceneStructure(
                            title="Scene",
                            source_start_anchor="BEGIN_WORD",
                            source_end_anchor="END_WORD",
                        )
                    ]
                ),
                _billing(),
                "structure",
            )
        shard_calls += 1
        count = 1 if shard_calls == 1 else 10
        if shard_calls == 2:
            assert "COMPLETE replacement beat set" in prompt
        return (
            VisualBeatShardResult(
                visual_beats=[
                    VisualBeatAnalysis(
                        title=f"beat-{index}",
                        visual_intent="grounded",
                        source_anchor="word",
                    )
                    for index in range(count)
                ]
            ),
            _billing(),
            f"shard-{shard_calls}",
        )

    provider._generate_structured = fake_generate  # type: ignore[method-assign]
    operation = await provider.submit(_request(source))

    assert shard_calls == 2
    assert operation.status is ProviderOperationStatus.COMPLETED