"""Asynchronous translation runner with durable per-chunk provider fencing."""

import asyncio
import contextlib
import hashlib
import logging
import uuid

from narrativex_worker.config import WorkerSettings
from narrativex_worker.providers.vertex import VertexGeminiProvider
from narrativex_worker.translation import (
    TranslationRequest,
    chunk_text,
    validate_translation,
)
from narrativex_worker.translation_repository import (
    ClaimedTranslationJob,
    TranslationWorkerRepository,
)


class TranslationLeaseLostError(RuntimeError):
    """Raised when another worker can reclaim the translation stage."""


class TranslationWorkerRunner:
    def __init__(self, settings: WorkerSettings, concurrency_gate: asyncio.Semaphore) -> None:
        self.settings = settings
        self.worker_id = f"{settings.worker_name}-translation-{uuid.uuid4()}"
        self.repository = TranslationWorkerRepository(settings.database_url, settings.lease_seconds)
        self.provider = (
            VertexGeminiProvider(settings) if settings.provider_mode == "vertex" else None
        )
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
                        await asyncio.wait(
                            self._tasks,
                            timeout=self.settings.poll_interval_seconds,
                            return_when=asyncio.FIRST_COMPLETED,
                        )
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
        heartbeat = asyncio.create_task(self._heartbeat(claimed))
        work = asyncio.create_task(self._process_claimed(claimed))
        try:
            done, _ = await asyncio.wait({heartbeat, work}, return_when=asyncio.FIRST_COMPLETED)
            if heartbeat in done:
                heartbeat.result()
            work.result()
        except TranslationLeaseLostError:
            self.logger.warning(
                "Translation lease lost; discarding provider result job=%s", claimed.job_id
            )
            if not work.done():
                work.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await work
        except Exception as exception:
            unknown = exception.__class__.__name__.endswith("UnknownError")
            self.logger.exception("Translation job=%s failed", claimed.job_id)
            with contextlib.suppress(Exception):
                await self.repository.fail(
                    claimed,
                    self.worker_id,
                    type(exception).__name__.upper()[:80],
                    unknown=unknown,
                )
        finally:
            for task in (heartbeat, work):
                if not task.done():
                    task.cancel()
            for task in (heartbeat, work):
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task

    async def _heartbeat(self, claimed: ClaimedTranslationJob) -> None:
        interval = max(3.0, self.settings.lease_seconds / 3)
        while True:
            await asyncio.sleep(interval)
            alive = await self.repository.heartbeat(claimed.stage_attempt_id, self.worker_id)
            if not alive:
                raise TranslationLeaseLostError(
                    f"Translation lease lost for stage_attempt={claimed.stage_attempt_id}"
                )

    async def _process_claimed(self, claimed: ClaimedTranslationJob) -> None:
        async with self.gate:
            if self.provider is None:
                await self.repository.fail(claimed, self.worker_id, "TRANSLATION_PROVIDER_DISABLED")
                return

            parts = chunk_text(claimed.source_text)
            translated: list[str] = []
            provider_name = "vertex"
            model = self.settings.vertex_model
            for index, part in enumerate(parts):
                operation = await self.repository.reserve_chunk_operation(
                    claimed,
                    provider_name,
                    index,
                    hashlib.sha256(part.encode("utf-8")).hexdigest(),
                )
                if operation.status == "COMPLETED" and operation.content is not None:
                    validate_translation(part, operation.content)
                    translated.append(operation.content)
                    continue
                if operation.status != "RESERVED":
                    await self.repository.fail(
                        claimed,
                        self.worker_id,
                        "TRANSLATION_RECONCILIATION_REQUIRED",
                        unknown=True,
                    )
                    return

                fenced = await self.repository.fence_before_provider_call(operation)
                response = await self.provider.translate(
                    TranslationRequest(
                        source_text=part,
                        source_language=claimed.source_language,
                        target_language=claimed.target_language,
                        previous_context=translated[-1][-800:] if translated else "",
                        next_context=parts[index + 1][:800] if index + 1 < len(parts) else "",
                    )
                )
                await self.repository.complete_chunk_operation(
                    claimed, self.worker_id, fenced, response
                )
                validate_translation(part, response.content)
                translated.append(response.content)
                provider_name = response.provider
                model = response.model

            await self.repository.complete_translation(
                claimed,
                self.worker_id,
                "\n\n".join(translated),
                provider_name,
                model,
            )
