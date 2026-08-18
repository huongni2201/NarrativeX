"""Worker lifecycle, durable claim/lease, and Chapter analysis execution."""

import asyncio
import contextlib
import logging
import signal
import sys
import uuid
from typing import Any

from narrativex_worker.config import WorkerSettings, get_settings
from narrativex_worker.providers import DisabledProvider, VertexGeminiProvider
from narrativex_worker.repository import ClaimedChapterAnalysisJob, WorkerRepository
from narrativex_worker.schema import ProviderOperationStatus
from narrativex_worker.service import WorkerService


class NarrativeXWorker:
    """Durable worker runner using PostgreSQL as source of truth."""

    def __init__(self, settings: WorkerSettings | None = None) -> None:
        self.settings = settings or get_settings()
        self._setup_logging()
        self._running = False
        self.worker_id = f"{self.settings.worker_name}-{uuid.uuid4()}"
        self.repository = WorkerRepository(
            database_url=self.settings.database_url,
            lease_seconds=self.settings.lease_seconds,
        )
        provider = (
            VertexGeminiProvider(self.settings)
            if self.settings.provider_mode == "vertex"
            else DisabledProvider()
        )
        self.service = WorkerService(provider)

    def _setup_logging(self) -> None:
        numeric_level = getattr(logging, self.settings.log_level.upper(), logging.INFO)
        logging.basicConfig(
            level=numeric_level,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            stream=sys.stdout,
            force=True,
        )
        self.logger = logging.getLogger("narrativex.worker")

    async def start(self, *, dry_run: bool = False) -> None:
        """Start worker, verify configuration, then poll PostgreSQL for durable work."""
        self.logger.info(
            "Starting %s in %s mode (provider=%s, log_level=%s)",
            self.settings.worker_name,
            self.settings.worker_env,
            self.settings.provider_mode,
            self.settings.log_level,
        )

        if dry_run:
            self.logger.info("Dry run completed successfully. Exiting.")
            return

        await self.repository.connect()
        self._running = True
        loop = asyncio.get_running_loop()

        if sys.platform != "win32":
            for sig in (signal.SIGINT, signal.SIGTERM):
                loop.add_signal_handler(sig, self.stop)

        try:
            while self._running:
                claimed = await self.repository.claim_next(self.worker_id)
                if claimed is None:
                    await asyncio.sleep(self.settings.poll_interval_seconds)
                    continue
                await self._process(claimed)
        except asyncio.CancelledError:
            self.logger.info("Worker received cancellation. Shutting down.")
            raise
        finally:
            await self.repository.close()
            self.logger.info("Worker stopped cleanly.")

    async def _process(self, claimed: ClaimedChapterAnalysisJob) -> None:
        self.logger.info(
            "Claimed Chapter analysis job=%s chapter=%s sourceHash=%s",
            claimed.job_id,
            claimed.request.chapter_id,
            claimed.request.source_hash,
        )
        heartbeat_task = asyncio.create_task(self._heartbeat_loop(claimed.stage_attempt_id))
        try:
            operation = await self.service.submit_chapter_analysis(claimed.request)
            if (
                operation.status is not ProviderOperationStatus.COMPLETED
                or operation.result is None
            ):
                raise RuntimeError(
                    f"Chapter analysis provider returned non-terminal status {operation.status}"
                )
            await self.repository.complete(claimed, self.worker_id, operation.result)
            self.logger.info("Completed Chapter analysis job=%s", claimed.job_id)
        except Exception as exception:
            self.logger.exception("Chapter analysis job=%s failed", claimed.job_id)
            with contextlib.suppress(Exception):
                await self.repository.fail(
                    claimed,
                    self.worker_id,
                    type(exception).__name__.upper()[:80],
                )
        finally:
            heartbeat_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat_task

    async def _heartbeat_loop(self, stage_attempt_id: int) -> None:
        interval = max(3.0, self.settings.lease_seconds / 3)
        while True:
            await asyncio.sleep(interval)
            still_owned = await self.repository.heartbeat(stage_attempt_id, self.worker_id)
            if not still_owned:
                raise RuntimeError("Worker lost its StageAttempt lease")

    def stop(self, *args: Any) -> None:
        """Signal worker to stop gracefully."""
        del args
        self.logger.info("Shutdown signal received.")
        self._running = False
