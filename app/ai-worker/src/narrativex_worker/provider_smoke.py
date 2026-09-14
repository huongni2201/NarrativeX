"""Opt-in smoke check for the local continuity-first Qwen analysis provider."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
from uuid import uuid4

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.qwen_continuity import ContinuityQwenProvider
from narrativex_worker.schema import ChapterAnalysisRequest, ProviderOperationStatus


async def run_smoke() -> None:
    settings = WorkerSettings(
        worker_env="provider-smoke",
        provider_mode="qwen",
        qwen_base_url=os.getenv("QWEN_BASE_URL", "http://localhost:8000/v1"),
        qwen_model=os.getenv("QWEN_MODEL", "Qwen/Qwen3-8B-AWQ"),
        qwen_timeout_seconds=600.0,
    )
    provider = ContinuityQwenProvider(settings)
    source_text = "一个年轻人走进房间，望向窗外，想起了失散多年的妹妹。"
    operation = await provider.submit(
        ChapterAnalysisRequest(
            project_id=uuid4(),
            story_version_id=uuid4(),
            chapter_id=uuid4(),
            chapter_row_version=0,
            source_hash=hashlib.sha256(source_text.encode("utf-8")).hexdigest(),
            source_text=source_text,
            source_language="zh-CN",
            preferred_locale="vi-VN",
        )
    )

    if operation.status != ProviderOperationStatus.COMPLETED or operation.result is None:
        raise RuntimeError(f"Qwen smoke analysis failed with status={operation.status}")
    if operation.usage is None or operation.usage.prompt_tokens <= 0:
        raise RuntimeError("Qwen smoke response did not report prompt token usage")

    print(
        json.dumps(
            {
                "status": "ok",
                "provider": operation.provider_key,
                "sceneCount": len(operation.result.scenes),
                "promptTokens": operation.usage.prompt_tokens,
                "candidateTokens": operation.usage.candidate_tokens,
            },
            separators=(",", ":"),
        )
    )


def main() -> None:
    asyncio.run(run_smoke())


if __name__ == "__main__":
    main()
