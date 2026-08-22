"""Asynchronous translation runner with durable provider-call fencing."""

import asyncio
import contextlib
import logging
import uuid

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.vertex import VertexGeminiProvider, VertexProviderError
from narrativex_worker.translation import TranslationRequest, chunk_text
from narrativex_worker.translation_repository import (
    ClaimedTranslationJob,
    TranslationWorkerRepository,
)


class TranslationWorkerRunner:
    def __init__(self, settings: WorkerSettings, concurrency_gate: asyncio.Semaphore) -> None:
        self.settings = settings
        self.worker_id = f"{settings.worker_name}-translation-{uuid.uuid4()}"
        self.repository = TranslationWorkerRepository(settings.database_url, settings.lease_seconds)
        self.provider = VertexGeminiProvider(settings) if settings.provider_mode == "vertex" else None
        self.gate = concurrency_gate
        self._running = False
        self._tasks: set[asyncio.Task[None]] = set()
        self.logger = logging.getLogger("narrativex.translation-worker")

    async def start(self, *, dry_run: bool = False) -> None:
        if dry_run:
            self.logger.info("Translation worker dry run completed")
            return
        await self.repository.connect()
        self._running = True
        try:
            while self._running:
                self._tasks = {task for task in self._tasks if not task.done()}
                if len(self._tasks) >= self.settings.worker_concurrency:
                    await asyncio.wait(self._tasks, return_when=asyncio.FIRST_COMPLETED)
                    continue
                claimed = await self.repository.claim_next(self.worker_id)
                if claimed is None:
                    if self._tasks:
                        await asyncio.wait(self._tasks, timeout=self.settings.poll_interval_seconds, return_when=asyncio.FIRST_COMPLETED)
                    else:
                        await asyncio.sleep(self.settings.poll_interval_seconds)
                    continue
                task = asyncio.create_task(self._process(claimed))
                self._tasks.add(task)
        finally:
            if self._tasks:
                await asyncio.gather(*self._tasks, return_exceptions=True)
            await self.repository.close()

    def stop(self) -> None:
        self._running = False

    async def _process(self, claimed: ClaimedTranslationJob) -> None:
        try:
            async with self.gate:
                operation = await self.repository.reserve_operation(claimed, "vertex")
                if operation.status == "COMPLETED" and operation.content:
                    from narrativex_worker.translation import TranslationResult
                    await self.repository.complete(
                        claimed, self.worker_id,
                        operation,
                        TranslationResult(operation.content, "vertex", self.settings.vertex_model),
                    )
                    return
                if operation.status != "RESERVED":
                    await self.repository.fail(claimed, self.worker_id, "TRANSLATION_RECONCILIATION_REQUIRED", unknown=True)
                    return
                fenced = await self.repository.fence_before_provider_call(operation)
                if self.provider is None:
                    await self.repository.fail(claimed, self.worker_id, "TRANSLATION_PROVIDER_DISABLED")
                    return
                result = await self._translate(claimed)
                await self.repository.complete(claimed, self.worker_id, fenced, result)
        except Exception as exception:
            unknown = exception.__class__.__name__.endswith("UnknownError")
            self.logger.exception("Translation job=%s failed", claimed.job_id)
            with contextlib.suppress(Exception):
                await self.repository.fail(claimed, self.worker_id, type(exception).__name__.upper()[:80], unknown=unknown)

    async def _translate(self, claimed: ClaimedTranslationJob):
        parts = chunk_text(claimed.source_text)
        translated: list[str] = []
        for index, part in enumerate(parts):
            result = await self.provider.translate(TranslationRequest(
                source_text=part,
                source_language=claimed.source_language,
                target_language=claimed.target_language,
                previous_context=translated[-1][-800:] if translated else "",
                next_context=parts[index + 1][:800] if index + 1 < len(parts) else "",
            ))
            translated.append(result.content)
        from narrativex_worker.translation import TranslationResult
        return TranslationResult("\n\n".join(translated), "vertex", self.settings.vertex_model,
                                sum(max(0, len(part) // 4) for part in parts),
                                sum(max(0, len(part) // 4) for part in translated))
