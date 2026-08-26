"""Opt-in smoke check for the real Vertex Gemini analysis provider."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
from uuid import uuid4

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.vertex import VertexGeminiProvider
from narrativex_worker.schema import ChapterAnalysisRequest, ProviderOperationStatus


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
    source_text = "Một nhân vật bước vào căn phòng và nhìn ra cửa sổ."
    operation = await provider.submit(
        ChapterAnalysisRequest(
            project_id=uuid4(),
            story_version_id=uuid4(),
            chapter_id=uuid4(),
            chapter_row_version=0,
            source_hash=hashlib.sha256(source_text.encode("utf-8")).hexdigest(),
            source_text=source_text,
            source_language="vi-VN",
        )
    )

    if operation.status != ProviderOperationStatus.COMPLETED or operation.result is None:
        raise RuntimeError(f"Vertex smoke analysis failed with status={operation.status}")
    if operation.billing is None or operation.billing.usage.prompt_tokens <= 0:
        raise RuntimeError("Vertex smoke response did not report prompt token usage")

    print(
        json.dumps(
            {
                "status": "ok",
                "provider": operation.provider_key,
                "sceneCount": len(operation.result.scenes),
                "promptTokens": operation.billing.usage.prompt_tokens,
                "candidateTokens": operation.billing.usage.candidate_tokens,
                "actualCostUsd": str(operation.billing.actual_cost),
            },
            separators=(",", ":"),
        )
    )


def main() -> None:
    asyncio.run(run_smoke())


if __name__ == "__main__":
    main()
