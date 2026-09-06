"""Worker lifecycle, durable claim/lease, and Chapter analysis execution."""

import asyncio
import contextlib
import logging
import signal
import sys
import uuid
from dataclasses import replace
from typing import Any

from narrativex_worker.analysis_execution import ChapterAnalysisExecutionContext
from narrativex_worker.billing_repository import ProviderBillingRepository
from narrativex_worker.config import WorkerSettings, get_settings
from narrativex_worker.providers.disabled import DisabledProvider
from narrativex_worker.providers.fake_analysis import FakeAnalysisProvider
from narrativex_worker.providers.ports import (
    ProviderOperation,
    ProviderSubmissionUnknownError,
)
from narrativex_worker.providers.vertex_continuity import ContinuityVertexGeminiProvider
from narrativex_worker.repository import (
    ClaimedChapterAnalysisJob,
    DurableProviderOperation,
    ProviderOperationStateConflictError,
    WorkerRepository,
    provider_request_fingerprint,
)
from narrativex_worker.schema import ProviderOperationStatus
from narrativex_worker.service import WorkerService
from narrativex_worker.task_runtime import reap_finished_tasks


class NarrativeXWorker:
    """Durable worker runner using PostgreSQL as source of truth."""

    def __init__(
        self,
        settings: WorkerSettings | None = None,
        concurrency_gate: asyncio.Semaphore | None = None,
    ) -> None:
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
            ContinuityVertexGeminiProvider(self.settings)
            if self.settings.provider_mode == "vertex"
            else FakeAnalysisProvider()
            if self.settings.provider_mode == "fake"
            else DisabledProvider()
        )
        self.service = WorkerService(provider)
        self._in_flight: set[asyncio.Task[None]] = set()
        self._concurrency_gate = concurrency_gate or asyncio.Semaphore(
            self.settings.worker_concurrency
        )

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
        reap_finished_tasks(
            self._in_flight,
            self.logger,
            worker_id=self.worker_id,
            task_label="Worker",
        )

    async def _process(self, claimed: ClaimedChapterAnalysisJob) -> None:
        self.logger.info(
            "Claimed Chapter analysis job=%s chapter=%s sourceHash=%s",
            claimed.job_id,
            claimed.request.chapter_id,
            claimed.request.source_hash,
        )
        processing_task = asyncio.create_task(self._execute_with_budget(claimed))
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

    async def _execute_with_budget(self, claimed: ClaimedChapterAnalysisJob) -> None:
        async with self._concurrency_gate:
            await self._execute_claimed(claimed)

    async def _execute_claimed(self, claimed: ClaimedChapterAnalysisJob) -> None:
        provider_key = self.service.provider.get_capabilities().provider_key
        durable = await self.repository.reserve_provider_operation(
            claimed,
            provider_key,
            provider_request_fingerprint(claimed, provider_key),
        )
        if not durable.created:
            await self._recover_provider_operation(claimed, durable)
            return

        await self._submit_reserved_provider_operation(claimed, durable)

    async def _submit_reserved_provider_operation(
        self, claimed: ClaimedChapterAnalysisJob, durable: DurableProviderOperation
    ) -> None:
        capabilities = self.service.provider.get_capabilities()
        if capabilities.supports_durable_subcall_resume:
            # The outer row is a local orchestration envelope. Real paid calls are fenced by the
            # subcall checkpoint repository, so marking this coordinator RUNNING remains resumable.
            active = await self.repository.mark_provider_orchestration_running(durable)
            execution = self._analysis_execution_context(claimed)
        else:
            # Legacy/direct providers still need the external-call UNKNOWN fence before submit.
            reconcile_delay = max(
                float(self.settings.lease_seconds),
                self.settings.vertex_timeout_seconds
                if self.settings.provider_mode == "vertex"
                else float(self.settings.lease_seconds),
            )
            active = await self.repository.mark_provider_operation_submission_unknown(
                durable, reconcile_delay
            )
            execution = None

        await self._run_provider_submission(
            claimed,
            active,
            execution=execution,
            has_durable_subcalls=capabilities.supports_durable_subcall_resume,
        )

    def _analysis_execution_context(
        self, claimed: ClaimedChapterAnalysisJob
    ) -> ChapterAnalysisExecutionContext:
        return ChapterAnalysisExecutionContext(
            stage_attempt_id=claimed.stage_attempt_id,
            claim_owner=self.repository.current_claim_owner(self.worker_id),
            checkpoints=self.repository.analysis_checkpoints(),
        )

    async def _run_provider_submission(
        self,
        claimed: ClaimedChapterAnalysisJob,
        durable: DurableProviderOperation,
        *,
        execution: ChapterAnalysisExecutionContext | None,
        has_durable_subcalls: bool,
    ) -> None:
        try:
            operation = await self.service.submit_chapter_analysis(
                claimed.request,
                execution=execution,
            )
        except ProviderSubmissionUnknownError as exception:
            error = f"Provider submission outcome is unknown: {type(exception).__name__}"
            if has_durable_subcalls:
                try:
                    unknown = await self.repository.mark_provider_operation_status(
                        durable, ProviderOperationStatus.UNKNOWN
                    )
                    await self.repository.suspend_provider_reconciliation(unknown, error)
                except ProviderOperationStateConflictError:
                    await self._resolve_provider_operation_conflict(claimed, durable)
                raise ProviderOperationUnreconcilableError(
                    f"{error}; durable subcall checkpoint is UNKNOWN, refusing blind retry"
                ) from exception
            with contextlib.suppress(ProviderOperationStateConflictError):
                await self.repository.suspend_provider_reconciliation(durable, error)
            raise ProviderOperationUnreconcilableError(
                f"{error}; no durable provider operation id was returned, refusing blind retry"
            ) from exception
        except Exception as exception:
            if has_durable_subcalls:
                # No blanket UNKNOWN promotion here: every external call has its own durable fence.
                # A coordinator/process restart can safely replay completed checkpoints.
                raise
            error = f"Provider submission outcome is unknown: {type(exception).__name__}"
            with contextlib.suppress(ProviderOperationStateConflictError):
                await self.repository.suspend_provider_reconciliation(durable, error)
            raise ProviderOperationUnreconcilableError(
                f"{error}; no durable provider operation id was returned, refusing blind retry"
            ) from exception

        await self._finish_provider_operation(claimed, durable, operation)

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

        if durable.status is ProviderOperationStatus.FAILED:
            raise RuntimeError("Chapter analysis provider previously failed")

        capabilities = self.service.provider.get_capabilities()
        if durable.status is ProviderOperationStatus.RESERVED:
            await self._submit_reserved_provider_operation(claimed, durable)
            return

        if durable.provider_key != capabilities.provider_key:
            error = (
                f"Configured provider {capabilities.provider_key} cannot reconcile "
                f"operation owned by {durable.provider_key}"
            )
            await self.repository.suspend_provider_reconciliation(durable, error)
            raise ProviderOperationUnreconcilableError(error)

        if (
            durable.status is ProviderOperationStatus.RUNNING
            and durable.provider_operation_id is None
            and capabilities.supports_durable_subcall_resume
        ):
            self.logger.info(
                "Resuming checkpointed Chapter analysis orchestration operation=%s job=%s",
                durable.id,
                claimed.job_id,
            )
            await self._run_provider_submission(
                claimed,
                durable,
                execution=self._analysis_execution_context(claimed),
                has_durable_subcalls=True,
            )
            return

        if durable.provider_operation_id is None:
            error = (
                f"Provider operation {durable.id} is {durable.status.value} without a durable "
                "provider operation id; refusing blind resubmission"
            )
            await self.repository.suspend_provider_reconciliation(durable, error)
            raise ProviderOperationUnreconcilableError(error)
        if not capabilities.supports_operation_reconciliation:
            error = (
                f"Provider {durable.provider_key} does not support durable operation "
                f"reconciliation for status {durable.status.value}"
            )
            await self.repository.suspend_provider_reconciliation(durable, error)
            raise ProviderOperationUnreconcilableError(error)

        operation = ProviderOperation(
            provider_key=durable.provider_key,
            operation_id=durable.provider_operation_id,
            status=durable.status,
        )
        try:
            reconciled = await self.service.reconcile_chapter_analysis(operation)
        except Exception as exception:
            error = f"Provider reconciliation failed: {type(exception).__name__}"
            try:
                await self.repository.record_provider_reconcile_error(durable, error)
            except ProviderOperationStateConflictError:
                await self._resolve_provider_operation_conflict(claimed, durable)
            raise ProviderOperationUnknownError(error) from exception
        await self._finish_provider_operation(claimed, durable, reconciled)

    async def _finish_provider_operation(
        self,
        claimed: ClaimedChapterAnalysisJob,
        durable: DurableProviderOperation,
        operation: ProviderOperation,
    ) -> None:
        if self.settings.provider_mode == "vertex" and operation.status in (
            ProviderOperationStatus.COMPLETED,
            ProviderOperationStatus.FAILED,
        ):
            if operation.billing is None:
                with contextlib.suppress(ProviderOperationStateConflictError):
                    await self.repository.suspend_provider_reconciliation(
                        durable,
                        "Terminal Vertex operation has no durable billing metadata",
                    )
                raise ProviderOperationUnreconcilableError(
                    "Terminal Vertex operation has no durable billing metadata"
                )
            try:
                row_version = await self.billing_repository.persist(durable, operation.billing)
                durable = replace(durable, row_version=row_version)
            except ProviderOperationStateConflictError:
                await self._resolve_provider_operation_conflict(claimed, durable)
                return
            except Exception as exception:
                error = (
                    f"Provider billing persistence outcome is unknown: {type(exception).__name__}"
                )
                with contextlib.suppress(ProviderOperationStateConflictError):
                    await self.repository.suspend_provider_reconciliation(durable, error)
                raise ProviderOperationUnreconcilableError(error) from exception

        if operation.status is ProviderOperationStatus.COMPLETED and operation.result is not None:
            try:
                durable = await self.repository.persist_provider_result(
                    durable, operation.operation_id, operation.result
                )
            except ProviderOperationStateConflictError:
                await self._resolve_provider_operation_conflict(claimed, durable)
                return
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
            try:
                await self.repository.mark_provider_operation_status(
                    durable, ProviderOperationStatus.FAILED, operation.operation_id
                )
            except ProviderOperationStateConflictError:
                await self._resolve_provider_operation_conflict(claimed, durable)
                return
            raise RuntimeError("Chapter analysis provider failed")

        next_status = (
            operation.status
            if operation.status
            in (ProviderOperationStatus.SUBMITTED, ProviderOperationStatus.RUNNING)
            else ProviderOperationStatus.UNKNOWN
        )
        if operation.operation_id is None:
            error = (
                f"Chapter analysis provider returned non-terminal status {operation.status} "
                "without a durable operation id"
            )
            try:
                await self.repository.suspend_provider_reconciliation(durable, error)
            except ProviderOperationStateConflictError:
                await self._resolve_provider_operation_conflict(claimed, durable)
                return
            raise ProviderOperationUnreconcilableError(error)

        capabilities = self.service.provider.get_capabilities()
        if not capabilities.supports_operation_reconciliation:
            error = (
                f"Provider {operation.provider_key} returned non-terminal status "
                f"{operation.status} but does not support durable reconciliation"
            )
            try:
                await self.repository.suspend_provider_reconciliation(durable, error)
            except ProviderOperationStateConflictError:
                await self._resolve_provider_operation_conflict(claimed, durable)
                return
            raise ProviderOperationUnreconcilableError(error)

        try:
            await self.repository.schedule_provider_operation_reconciliation(
                durable,
                next_status,
                operation.operation_id,
            )
        except ProviderOperationStateConflictError:
            await self._resolve_provider_operation_conflict(claimed, durable)
            return
        raise ProviderOperationUnknownError(
            f"Chapter analysis provider returned non-terminal status {operation.status}"
        )

    async def _resolve_provider_operation_conflict(
        self, claimed: ClaimedChapterAnalysisJob, stale: DurableProviderOperation
    ) -> None:
        latest = await self.repository.get_provider_operation(stale.id)
        if latest.status is ProviderOperationStatus.COMPLETED:
            if latest.normalized_result is None:
                raise ProviderOperationUnknownError(
                    "Completed provider operation has no durable normalized result"
                )
            await self.repository.complete(claimed, self.worker_id, latest.normalized_result)
            self.logger.info(
                "Replayed provider result after CAS conflict for job=%s", claimed.job_id
            )
            return
        if latest.status is ProviderOperationStatus.FAILED:
            raise RuntimeError("Provider operation was already failed by another worker")
        self.logger.info(
            "Discarding stale provider response for operation=%s at row_version=%s",
            stale.id,
            stale.row_version,
        )
        raise ProviderOperationUnknownError(
            f"Provider operation {stale.id} advanced during reconciliation"
        )

    async def _reconcile_provider_operations(self) -> None:
        operations = await self.repository.list_provider_operations(
            (
                ProviderOperationStatus.UNKNOWN,
                ProviderOperationStatus.SUBMITTED,
                ProviderOperationStatus.RUNNING,
            ),
            limit=self.settings.worker_concurrency,
        )
        capabilities = self.service.provider.get_capabilities()
        for durable in operations:
            if durable.provider_key != capabilities.provider_key:
                await self.repository.suspend_provider_reconciliation(
                    durable,
                    f"Configured provider {capabilities.provider_key} cannot reconcile "
                    f"operation owned by {durable.provider_key}",
                )
                continue
            if durable.provider_operation_id is None:
                await self.repository.suspend_provider_reconciliation(
                    durable,
                    "Provider operation has no durable provider operation id",
                )
                continue
            if not capabilities.supports_operation_reconciliation:
                await self.repository.suspend_provider_reconciliation(
                    durable,
                    f"Provider {durable.provider_key} does not support durable reconciliation",
                )
                continue

            operation = ProviderOperation(
                provider_key=durable.provider_key,
                operation_id=durable.provider_operation_id,
                status=durable.status,
            )
            try:
                reconciled = await self.service.reconcile_chapter_analysis(operation)
            except Exception as exception:
                await self.repository.record_provider_reconcile_error(
                    durable,
                    f"Provider reconciliation failed: {type(exception).__name__}",
                )
                continue
            try:
                if reconciled.billing is not None:
                    row_version = await self.billing_repository.persist(durable, reconciled.billing)
                    durable = replace(durable, row_version=row_version)
                if (
                    reconciled.status is ProviderOperationStatus.COMPLETED
                    and reconciled.result is not None
                ):
                    await self.repository.persist_provider_result(
                        durable, reconciled.operation_id, reconciled.result
                    )
                    await self.repository.release_stage_for_provider_replay(durable)
                elif reconciled.status is ProviderOperationStatus.FAILED:
                    await self.repository.mark_provider_operation_status(
                        durable, ProviderOperationStatus.FAILED, reconciled.operation_id
                    )
                    await self.repository.release_stage_for_provider_replay(durable)
                elif reconciled.operation_id is not None:
                    next_status = (
                        reconciled.status
                        if reconciled.status
                        in (ProviderOperationStatus.SUBMITTED, ProviderOperationStatus.RUNNING)
                        else ProviderOperationStatus.UNKNOWN
                    )
                    await self.repository.schedule_provider_operation_reconciliation(
                        durable,
                        next_status,
                        reconciled.operation_id,
                    )
                else:
                    await self.repository.suspend_provider_reconciliation(
                        durable,
                        "Provider reconciliation returned a non-terminal state "
                        "without an operation id",
                    )
            except ProviderOperationStateConflictError:
                with contextlib.suppress(Exception):
                    latest = await self.repository.get_provider_operation(durable.id)
                    self.logger.info(
                        "Discarded stale reconciliation response for operation=%s; "
                        "latest status=%s row_version=%s",
                        durable.id,
                        latest.status.value,
                        latest.row_version,
                    )

    async def _heartbeat_loop(self, stage_attempt_id: uuid.UUID) -> None:
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
    """A durable provider operation exists and must reconcile before retry."""


class ProviderOperationUnreconcilableError(RuntimeError):
    """Provider outcome is ambiguous but cannot be safely reconciled or resubmitted."""
