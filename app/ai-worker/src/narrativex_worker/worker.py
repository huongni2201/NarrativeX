"""Worker lifecycle, durable claim/lease, and Chapter analysis execution."""

import asyncio
import contextlib
import logging
import signal
import sys
import uuid
from typing import Any

from narrativex_worker.billing_repository import ProviderBillingRepository
from narrativex_worker.config import WorkerSettings, get_settings
from narrativex_worker.providers import DisabledProvider, VertexGeminiProvider
from narrativex_worker.providers.ports import ProviderOperation
from narrativex_worker.repository import (
    ClaimedChapterAnalysisJob,
    DurableProviderOperation,
    WorkerRepository,
    provider_request_fingerprint,
)
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
            pool_size=max(5, self.settings.worker_concurrency * 2 + 1),
        )
        self.billing_repository = ProviderBillingRepository(self.settings.database_url)
        provider = (
            VertexGeminiProvider(self.settings)
            if self.settings.provider_mode == "vertex"
            else DisabledProvider()
        )
        self.service = WorkerService(provider)
        self._in_flight: set[asyncio.Task[None]] = set()

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
            "Starting %s in %s mode (provider=%s, log_level=%s, concurrency=%s)",
            self.settings.worker_name,
            self.settings.worker_env,
            self.settings.provider_mode,
            self.settings.log_level,
            self.settings.worker_concurrency,
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
                self._reap_finished_tasks()
                if len(self._in_flight) >= self.settings.worker_concurrency:
                    await asyncio.wait(self._in_flight, return_when=asyncio.FIRST_COMPLETED)
                    continue

                await self._reconcile_provider_operations()
                claimed = await self.repository.claim_next(self.worker_id)
                if claimed is None:
                    if self._in_flight:
                        done, _ = await asyncio.wait(
                            self._in_flight,
                            timeout=self.settings.poll_interval_seconds,
                            return_when=asyncio.FIRST_COMPLETED,
                        )
                        if done:
                            self._reap_finished_tasks()
                    else:
                        await asyncio.sleep(self.settings.poll_interval_seconds)
                    continue

                task = asyncio.create_task(self._process(claimed))
                self._in_flight.add(task)
        except asyncio.CancelledError:
            self.logger.info("Worker received cancellation. Shutting down.")
            raise
        finally:
            if self._in_flight:
                await asyncio.gather(*self._in_flight, return_exceptions=True)
                self._in_flight.clear()
            await self.repository.close()
            self.logger.info("Worker stopped cleanly.")

    def _reap_finished_tasks(self) -> None:
        finished = {task for task in self._in_flight if task.done()}
        for task in finished:
            self._in_flight.remove(task)
            with contextlib.suppress(asyncio.CancelledError):
                exception = task.exception()
                if exception is not None:
                    self.logger.error("Worker task ended unexpectedly", exc_info=exception)

    async def _process(self, claimed: ClaimedChapterAnalysisJob) -> None:
        self.logger.info(
            "Claimed Chapter analysis job=%s chapter=%s sourceHash=%s",
            claimed.job_id,
            claimed.request.chapter_id,
            claimed.request.source_hash,
        )
        processing_task = asyncio.create_task(self._execute_claimed(claimed))
        heartbeat_task = asyncio.create_task(self._heartbeat_loop(claimed.stage_attempt_id))
        try:
            done, _ = await asyncio.wait(
                {processing_task, heartbeat_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            if heartbeat_task in done:
                await heartbeat_task
                raise RuntimeError("Heartbeat loop stopped unexpectedly")

            await processing_task
        except Exception as exception:
            if isinstance(exception, ProviderOperationUnknownError):
                self.logger.warning(
                    "Provider operation for job=%s is UNKNOWN; reconciliation will decide retry",
                    claimed.job_id,
                )
                return
            self.logger.exception("Chapter analysis job=%s failed", claimed.job_id)
            if not processing_task.done():
                processing_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await processing_task
            with contextlib.suppress(Exception):
                await self.repository.fail(
                    claimed,
                    self.worker_id,
                    type(exception).__name__.upper()[:80],
                )
        finally:
            for task in (processing_task, heartbeat_task):
                if not task.done():
                    task.cancel()
            for task in (processing_task, heartbeat_task):
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task

    async def _execute_claimed(self, claimed: ClaimedChapterAnalysisJob) -> None:
        if not hasattr(self.service, "provider"):
            operation = await self.service.submit_chapter_analysis(claimed.request)
            if (
                operation.status is not ProviderOperationStatus.COMPLETED
                or operation.result is None
            ):
                raise RuntimeError(
                    f"Chapter analysis provider returned non-terminal status {operation.status}"
                )
            await self.repository.complete(claimed, self.worker_id, operation.result)
            return

        provider_key = self.service.provider.get_capabilities().provider_key
        durable = await self.repository.reserve_provider_operation(
            claimed,
            provider_key,
            provider_request_fingerprint(claimed, provider_key),
        )
        if not durable.created:
            await self._recover_provider_operation(claimed, durable)
            return

        await self.repository.mark_provider_operation_submitted(durable.id, None)
        try:
            operation = await self.service.submit_chapter_analysis(claimed.request)
        except Exception as exception:
            await self.repository.mark_provider_operation_status(
                durable.id, ProviderOperationStatus.UNKNOWN
            )
            raise ProviderOperationUnknownError(
                f"Provider submission outcome is unknown: {type(exception).__name__}"
            ) from exception

        await self._finish_provider_operation(claimed, durable.id, operation)

    async def _recover_provider_operation(
        self, claimed: ClaimedChapterAnalysisJob, durable: DurableProviderOperation
    ) -> None:
        if durable.status is ProviderOperationStatus.COMPLETED:
            if durable.normalized_result is None:
                raise ProviderOperationUnknownError(
                    "Completed provider operation has no durable normalized result"
                )
            await self.repository.complete(claimed, self.worker_id, durable.normalized_result)
            self.logger.info(
                "Replayed durable provider result for Chapter analysis job=%s", claimed.job_id
            )
            return

        operation = ProviderOperation(
            provider_key=durable.provider_key,
            operation_id=durable.provider_operation_id,
            status=durable.status,
        )
        try:
            reconciled = await self.service.reconcile_chapter_analysis(operation)
        except Exception as exception:
            await self.repository.mark_provider_operation_status(
                durable.id, ProviderOperationStatus.UNKNOWN
            )
            raise ProviderOperationUnknownError(
                f"Provider reconciliation outcome is unknown: {type(exception).__name__}"
            ) from exception
        await self._finish_provider_operation(claimed, durable.id, reconciled)

    async def _finish_provider_operation(
        self,
        claimed: ClaimedChapterAnalysisJob,
        durable_id: int,
        operation: ProviderOperation,
    ) -> None:
        if operation.provider_key == "vertex" and operation.status in (
            ProviderOperationStatus.COMPLETED,
            ProviderOperationStatus.FAILED,
        ):
            if operation.billing is None:
                await self.repository.mark_provider_operation_status(
                    durable_id, ProviderOperationStatus.UNKNOWN, operation.operation_id
                )
                raise ProviderOperationUnknownError(
                    "Terminal Vertex operation has no durable billing metadata"
                )
            try:
                await self.billing_repository.persist(durable_id, operation.billing)
            except Exception as exception:
                await self.repository.mark_provider_operation_status(
                    durable_id, ProviderOperationStatus.UNKNOWN, operation.operation_id
                )
                raise ProviderOperationUnknownError(
                    f"Provider billing persistence outcome is unknown: {type(exception).__name__}"
                ) from exception

        if operation.status is ProviderOperationStatus.COMPLETED and operation.result is not None:
            try:
                durable = await self.repository.persist_provider_result(
                    durable_id, operation.operation_id, operation.result
                )
            except Exception as exception:
                raise ProviderOperationUnknownError(
                    f"Provider result persistence outcome is unknown: {type(exception).__name__}"
                ) from exception
            if durable.normalized_result is None:
                raise RuntimeError("Persisted provider result could not be reconstructed")
            await self.repository.complete(claimed, self.worker_id, durable.normalized_result)
            self.logger.info("Completed Chapter analysis job=%s", claimed.job_id)
            return
        if operation.status is ProviderOperationStatus.FAILED:
            await self.repository.mark_provider_operation_status(
                durable_id, ProviderOperationStatus.FAILED, operation.operation_id
            )
            raise RuntimeError("Chapter analysis provider failed")

        next_status = (
            operation.status
            if operation.status
            in (ProviderOperationStatus.SUBMITTED, ProviderOperationStatus.RUNNING)
            else ProviderOperationStatus.UNKNOWN
        )
        await self.repository.mark_provider_operation_status(
            durable_id, next_status, operation.operation_id
        )
        raise ProviderOperationUnknownError(
            f"Chapter analysis provider returned non-terminal status {operation.status}"
        )

    async def _reconcile_provider_operations(self) -> None:
        if not hasattr(self.service, "provider"):
            return
        operations = await self.repository.list_provider_operations(
            (ProviderOperationStatus.UNKNOWN,), limit=self.settings.worker_concurrency
        )
        for durable in operations:
            operation = ProviderOperation(
                provider_key=durable.provider_key,
                operation_id=durable.provider_operation_id,
                status=durable.status,
            )
            try:
                reconciled = await self.service.reconcile_chapter_analysis(operation)
            except Exception:
                continue
            if reconciled.billing is not None:
                with contextlib.suppress(Exception):
                    await self.billing_repository.persist(durable.id, reconciled.billing)
            if (
                reconciled.status is ProviderOperationStatus.COMPLETED
                and reconciled.result is not None
            ):
                with contextlib.suppress(Exception):
                    await self.repository.persist_provider_result(
                        durable.id, reconciled.operation_id, reconciled.result
                    )
            elif reconciled.status is ProviderOperationStatus.FAILED:
                await self.repository.mark_provider_operation_status(
                    durable.id, ProviderOperationStatus.FAILED, reconciled.operation_id
                )

    async def _heartbeat_loop(self, stage_attempt_id: int) -> None:
        interval = max(3.0, self.settings.lease_seconds / 3)
        while True:
            await asyncio.sleep(interval)
            still_owned = await self.repository.heartbeat(stage_attempt_id, self.worker_id)
            if not still_owned:
                raise RuntimeError("Worker lost its StageAttempt lease")

    def stop(self, *args: Any) -> None:
        """Signal worker to stop gracefully after current jobs finish."""
        del args
        self.logger.info("Shutdown signal received.")
        self._running = False


class ProviderOperationUnknownError(RuntimeError):
    """An external request may have been accepted; never route this to blind retry."""
