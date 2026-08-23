"""Opt-in smoke check for the real Vertex Gemini provider."""

from __future__ import annotations

import asyncio
import json
import os

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.vertex import VertexGeminiProvider
from narrativex_worker.translation import TranslationRequest


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required for the real-provider smoke check")
    return value


async def run_smoke() -> None:
    settings = WorkerSettings(
        worker_env="provider-smoke",
        provider_mode="vertex",
        vertex_project_id=_required_env("VERTEX_PROJECT_ID"),
        vertex_location=os.getenv("VERTEX_LOCATION", "us-central1"),
        vertex_model=os.getenv("VERTEX_MODEL", "gemini-2.5-flash"),
        vertex_timeout_seconds=60.0,
    )
    provider = VertexGeminiProvider(settings)
    response = await provider.translate(
        TranslationRequest(
            source_text="NarrativeX provider smoke test.",
            source_language="en",
            target_language="vi",
        )
    )

    if not response.content.strip():
        raise RuntimeError("Vertex smoke response was empty")
    if response.provider != "vertex":
        raise RuntimeError(f"Unexpected provider in smoke response: {response.provider}")
    if response.billing.usage.prompt_tokens <= 0:
        raise RuntimeError("Vertex smoke response did not report prompt token usage")

    print(
        json.dumps(
            {
                "status": "ok",
                "provider": response.provider,
                "model": response.model,
                "promptTokens": response.billing.usage.prompt_tokens,
                "candidateTokens": response.billing.usage.candidate_tokens,
                "actualCostUsd": str(response.billing.actual_cost),
            },
            separators=(",", ":"),
        )
    )


def main() -> None:
    asyncio.run(run_smoke())


if __name__ == "__main__":
    main()
