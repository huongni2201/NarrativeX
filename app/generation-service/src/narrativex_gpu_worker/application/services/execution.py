from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from narrativex_gpu_worker.application.errors import (
    CapacityError,
    ExecutorNotSupportedError,
    FingerprintConflictError,
)
from narrativex_gpu_worker.application.ports.outbound import (
    ExecutionJournalPort,
    ExecutorCatalogPort,
)
from narrativex_gpu_worker.contracts import (
    ComputeError,
    ComputeObservation,
    ComputeTask,
    ErrorCategory,
    ExecutionState,
)

LOGGER = logging.getLogger("narrativex.gpu_worker.application")


class ExecutionApplicationService:
    """Coordinates submission, replay, lifecycle and recovery through ports."""

    def __init__(
        self,
        journal: ExecutionJournalPort,
        executor_catalog: ExecutorCatalogPort,
        max_concurrency: int,
    ) -> None:
        if max_concurrency < 1:
            raise ValueError("max_concurrency must be at least one")
        self._journal = journal
        self._executor_catalog = executor_catalog
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._max_concurrency = max_concurrency
        self._admission_lock = asyncio.Lock()
        self._active: dict[tuple[UUID, UUID], asyncio.Task[None]] = {}
        self._cancellations: dict[tuple[UUID, UUID], asyncio.Event] = {}

    async def start(self) -> None:
        await self._journal.initialize()
        for task in await self._journal.recoverable():
            self._schedule(task)

    async def stop(self) -> None:
        for cancellation in self._cancellations.values():
            cancellation.set()
        running = tuple(self._active.values())
        for task in running:
            task.cancel()
        await asyncio.gather(*running, return_exceptions=True)

    async def submit(self, task: ComputeTask) -> ComputeObservation:
        async with self._admission_lock:
            try:
                existing = await self._journal.replay(task)
            except ValueError as exc:
                raise FingerprintConflictError from exc
            if existing is not None:
                return existing
            self._executor_catalog.resolve(task)
            if len(self._active) >= self._max_concurrency:
                raise CapacityError("worker capacity exhausted")
            try:
                observation, _ = await self._journal.save_accepted(task)
            except ValueError as exc:
                raise FingerprintConflictError from exc
            self._schedule(task)
            return observation

    async def get(self, task_id: UUID, attempt_id: UUID) -> ComputeObservation | None:
        return await self._journal.load(task_id, attempt_id)

    async def cancel(self, task_id: UUID, attempt_id: UUID) -> ComputeObservation | None:
        current = await self._journal.load(task_id, attempt_id)
        if current is None or current.state in {
            ExecutionState.SUCCEEDED,
            ExecutionState.FAILED,
            ExecutionState.CANCELED,
        }:
            return current
        event = self._cancellations.setdefault((task_id, attempt_id), asyncio.Event())
        event.set()
        return current

    def _schedule(self, task: ComputeTask) -> None:
        key = (task.task_id, task.attempt_id)
        if key in self._active:
            return
        cancellation = self._cancellations.setdefault(key, asyncio.Event())
        running = asyncio.create_task(self._execute(task, cancellation))
        self._active[key] = running
        running.add_done_callback(lambda completed: self._task_done(key, completed))

    def _task_done(self, key: tuple[UUID, UUID], completed: asyncio.Task[None]) -> None:
        self._active.pop(key, None)
        if completed.cancelled():
            return
        if completed.exception() is not None:
            LOGGER.error("Execution task terminated unexpectedly taskId=%s attemptId=%s", *key)

    async def _execute(self, task: ComputeTask, cancellation: asyncio.Event) -> None:
        async with self._semaphore:
            running = ComputeObservation(
                task_id=task.task_id,
                attempt_id=task.attempt_id,
                state=ExecutionState.RUNNING,
                sequence=1,
                observed_at=datetime.now(UTC),
            )
            await self._journal.update(running)
            try:
                executor = self._executor_catalog.resolve(task)
                async with asyncio.timeout(task.constraints.max_runtime_seconds):
                    result = await executor.execute(task, cancellation)
                state = (
                    ExecutionState.CANCELED if cancellation.is_set() else ExecutionState.SUCCEEDED
                )
                completed = ComputeObservation(
                    task_id=task.task_id,
                    attempt_id=task.attempt_id,
                    state=state,
                    sequence=2,
                    observed_at=datetime.now(UTC),
                    execution_handle=result.execution_handle,
                    progress=1 if state == ExecutionState.SUCCEEDED else None,
                    outputs=result.outputs,
                    metrics=result.metrics,
                )
            except asyncio.CancelledError:
                raise
            except (TimeoutError, ExecutorNotSupportedError) as exc:
                completed = self._failure(
                    task,
                    "EXECUTION_UNAVAILABLE",
                    ErrorCategory.TRANSIENT,
                    str(exc) or "Execution timed out or became unavailable",
                )
            except Exception:
                LOGGER.exception(
                    "Executor failed taskId=%s attemptId=%s", task.task_id, task.attempt_id
                )
                completed = self._failure(
                    task, "EXECUTOR_FAILURE", ErrorCategory.TRANSIENT, "Executor failed safely"
                )
            await self._journal.update(completed)

    @staticmethod
    def _failure(
        task: ComputeTask, code: str, category: ErrorCategory, message: str
    ) -> ComputeObservation:
        return ComputeObservation(
            task_id=task.task_id,
            attempt_id=task.attempt_id,
            state=ExecutionState.FAILED,
            sequence=2,
            observed_at=datetime.now(UTC),
            error=ComputeError(
                code=code,
                category=category,
                message=message,
                retry_after_seconds=None,
                details={},
            ),
        )
