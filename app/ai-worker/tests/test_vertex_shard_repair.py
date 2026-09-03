from decimal import Decimal
from unittest.mock import Mock, patch

import httpx
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
    CharacterAnalysis,
    ProviderOperationStatus,
    VisualBeatAnalysis,
)


def _billing() -> ProviderBilling:
    return ProviderBilling(
        actual_cost=Decimal("0.000001000"),
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


def _provider() -> VertexGeminiProvider:
    settings = WorkerSettings(
        provider_mode="vertex",
        vertex_project_id="test-project",
        vertex_model="gemini-2.5-flash",
        vertex_analysis_shard_concurrency=1,
        vertex_analysis_repair_attempts=1,
    )
    credentials = Mock(valid=True, token="token")
    with patch(
        "narrativex_worker.providers.vertex.google.auth.default",
        return_value=(credentials, None),
    ):
        return VertexGeminiProvider(settings)


def _structure() -> ChapterStructureResult:
    return ChapterStructureResult(
        scenes=[
            SceneStructure(
                title="Scene",
                source_start_anchor="BEGIN_WORD",
                source_end_anchor="END_WORD",
            )
        ]
    )


def _character_structure() -> ChapterStructureResult:
    return ChapterStructureResult(
        characters=[
            CharacterAnalysis(key="lead", name="Lead"),
            CharacterAnalysis(key="other", name="Other"),
        ],
        scenes=[
            SceneStructure(
                title="Scene",
                source_start_anchor="BEGIN_WORD",
                source_end_anchor="END_WORD",
                characters=[{"character_key": "lead"}],
            )
        ],
    )


def _beats(anchor: str, count: int, *, character_key: str | None = None) -> VisualBeatShardResult:
    characters = [] if character_key is None else [{"character_key": character_key, "role": "PRIMARY"}]
    return VisualBeatShardResult(
        visual_beats=[
            VisualBeatAnalysis(
                title=f"beat-{index}",
                visual_intent="grounded",
                source_anchor=anchor,
                characters=characters,
            )
            for index in range(count)
        ]
    )


@pytest.mark.asyncio
async def test_invalid_source_anchor_gets_full_replacement_repair() -> None:
    source = "BEGIN_WORD " + ("word " * 100).strip() + " END_WORD"
    provider = _provider()
    shard_calls = 0

    async def fake_generate(
        client: httpx.AsyncClient, token: str, prompt: str, model: type[object]
    ):
        nonlocal shard_calls
        del client, token
        if model is ChapterStructureResult:
            return _structure(), _billing(), "structure"
        shard_calls += 1
        if shard_calls == 1:
            return _beats("NOT_IN_SHARD", 10), _billing(), "invalid-anchor"
        assert "repair" in prompt.lower()
        return _beats("word", 10), _billing(), "repaired-anchor"

    provider._generate_structured = fake_generate  # type: ignore[method-assign]

    operation = await provider.submit(_request(source))

    assert shard_calls == 2
    assert operation.status is ProviderOperationStatus.COMPLETED


@pytest.mark.asyncio
async def test_over_dense_shard_gets_full_replacement_repair() -> None:
    source = "BEGIN_WORD " + ("word " * 100).strip() + " END_WORD"
    provider = _provider()
    shard_calls = 0

    async def fake_generate(
        client: httpx.AsyncClient, token: str, prompt: str, model: type[object]
    ):
        nonlocal shard_calls
        del client, token
        if model is ChapterStructureResult:
            return _structure(), _billing(), "structure"
        shard_calls += 1
        if shard_calls == 1:
            return _beats("word", 21), _billing(), "over-dense"
        assert "repair" in prompt.lower()
        return _beats("word", 10), _billing(), "repaired-density"

    provider._generate_structured = fake_generate  # type: ignore[method-assign]

    operation = await provider.submit(_request(source))

    assert shard_calls == 2
    assert operation.status is ProviderOperationStatus.COMPLETED


@pytest.mark.asyncio
async def test_invalid_structured_shard_output_gets_one_repair() -> None:
    source = "BEGIN_WORD " + ("word " * 100).strip() + " END_WORD"
    provider = _provider()
    shard_calls = 0

    async def fake_generate(
        client: httpx.AsyncClient, token: str, prompt: str, model: type[object]
    ):
        nonlocal shard_calls
        del client, token
        if model is ChapterStructureResult:
            return _structure(), _billing(), "structure"
        shard_calls += 1
        if shard_calls == 1:
            return None, _billing(), "invalid-schema"
        assert "repair" in prompt.lower()
        return _beats("word", 10), _billing(), "repaired-schema"

    provider._generate_structured = fake_generate  # type: ignore[method-assign]

    operation = await provider.submit(_request(source))

    assert shard_calls == 2
    assert operation.status is ProviderOperationStatus.COMPLETED


@pytest.mark.asyncio
async def test_beat_character_outside_scene_gets_full_replacement_repair() -> None:
    source = "BEGIN_WORD " + ("word " * 100).strip() + " END_WORD"
    provider = _provider()
    shard_calls = 0

    async def fake_generate(
        client: httpx.AsyncClient, token: str, prompt: str, model: type[object]
    ):
        nonlocal shard_calls
        del client, token
        if model is ChapterStructureResult:
            return _character_structure(), _billing(), "structure"
        shard_calls += 1
        if shard_calls == 1:
            return _beats("word", 10, character_key="other"), _billing(), "wrong-character"
        assert "repair" in prompt.lower()
        return _beats("word", 10, character_key="lead"), _billing(), "repaired-character"

    provider._generate_structured = fake_generate  # type: ignore[method-assign]

    operation = await provider.submit(_request(source))

    assert shard_calls == 2
    assert operation.status is ProviderOperationStatus.COMPLETED
