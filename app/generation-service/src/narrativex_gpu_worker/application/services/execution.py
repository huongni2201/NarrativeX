from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID

from narrativex_gpu_worker.application.errors import (
    AmbiguousOutcomeError,
    CapacityError,
    DeadlineExceededError,
    ExecutionCanceledError,
    ExecutorNotSupportedError,
    FingerprintConflictError,
    MissingDurableContextError,
    ResidencyTransitionError,
)
from narrativex_gpu_worker.application.ports.execution import ExecutionContext
from narrativex_gpu_worker.application.ports.executors import ExecutorCatalogPort
from narrativex_gpu_worker.application.ports.journal import ExecutionJournalPort
from narrativex_gpu_worker.application.ports.residency import (
    NullRuntimeResidency,
    RuntimeFamily,
    RuntimeRequirement,
    RuntimeResidencyPort,
)
from narrativex_gpu_worker.contracts import (
    ComputeError,
    ComputeObservation,
    ComputeTask,
    ErrorCategory,
    ExecutionState,
)
from narrativex_gpu_worker.domain.submission import SubmissionState

LOGGER = logging.getLogger("narrativex.gpu_worker.application")


class ExecutionApplicationService:
    """Coordinates submission, replay, lifecycle and recovery through ports."""

    def __init__(
        self,
        journal: ExecutionJournalPort,
        executor_catalog: ExecutorCatalogPort,
        max_concurrency: int,
        now_fn: Callable[[], datetime] | None = None,
        residency: RuntimeResidencyPort | None = None,
    ) -> None:
        if max_concurrency < 1:
            raise ValueError("max_concurrency must be at least one")
        self._journal = journal
        self._executor_catalog = executor_catalog
        self._residency = residency or NullRuntimeResidency()
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._max_concurrency = max_concurrency
        self._admission_lock = asyncio.Lock()
        self._now_fn = now_fn or (lambda: datetime.now(UTC))
        self._active: dict[tuple[UUID, UUID], asyncio.Task[None]] = {}
        self._cancellations: dict[tuple[UUID, UUID], asyncio.Event] = {}

    async def _next_sequence(self, task_id: UUID, attempt_id: UUID) -> int:
        current = await self._journal.load(task_id, attempt_id)
        return (current.sequence + 1) if current is not None else 1

    async def start(self) -> None:
        await self._journal.initialize()
        now = self._now_fn()
        recoverable = await self._journal.recoverable()
        for task, cancel_requested, execution_handle, submission_state in recoverable:
            next_seq = await self._next_sequence(task.task_id, task.attempt_id)
            if task.constraints.deadline <= now:
                failed = self._failure(
                    task,
                    "DEADLINE_EXCEEDED",
                    ErrorCategory.PERMANENT,
                    "Task deadline expired before recovery",
                    sequence=next_seq,
                )
                await self._journal.update(failed)
            elif cancel_requested:
                if submission_state.is_ambiguous:
                    await self._journal.mark_unknown(task.task_id, task.attempt_id)
                    LOGGER.warning(
                    "Recovery found cancel request for ambiguous attempt taskId=%s "
                    "attemptId=%s; holding without false cancellation",
                        task.task_id,
                        task.attempt_id,
                    )
                else:
                    canceled = ComputeObservation(
                        task_id=task.task_id,
                        attempt_id=task.attempt_id,
                        state=ExecutionState.CANCELED,
                        sequence=next_seq,
                        observed_at=now,
                        execution_handle=execution_handle,
                    )
                    await self._journal.update(canceled)
            elif submission_state == SubmissionState.NOT_SUBMITTED:
                self._schedule(task, existing_handle=None)
            elif submission_state == SubmissionState.SUBMITTED:
                self._schedule(task, existing_handle=execution_handle)
            elif submission_state.is_ambiguous:
                await self._journal.mark_unknown(task.task_id, task.attempt_id)
                LOGGER.warning(
                    "Recovery found ambiguous attempt taskId=%s attemptId=%s state=%s; "
                    "holding without blind-resubmit",
                    task.task_id,
                    task.attempt_id,
                    submission_state,
                )

    async def stop(self) -> None:
        # Controlled shutdown cancels asyncio tasks locally without persisting user cancellation
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

            # Validate deadline before ACCEPTED
            now = self._now_fn()
            if task.constraints.deadline <= now:
                raise DeadlineExceededError("task deadline has already passed")

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
        # Journal before memory
        await self._journal.request_cancel(task_id, attempt_id)
        event = self._cancellations.get((task_id, attempt_id))
        if event is not None:
            event.set()
        return current

    def _schedule(self, task: ComputeTask, existing_handle: str | None = None) -> None:
        key = (task.task_id, task.attempt_id)
        if key in self._active:
            return
        cancellation = self._cancellations.setdefault(key, asyncio.Event())
        running = asyncio.create_task(self._execute(task, cancellation, existing_handle))
        self._active[key] = running
        running.add_done_callback(lambda completed: self._task_done(key, completed))

    def _task_done(self, key: tuple[UUID, UUID], completed: asyncio.Task[None]) -> None:
        self._active.pop(key, None)
        self._cancellations.pop(key, None)
        if completed.cancelled():
            return
        if completed.exception() is not None:
            LOGGER.error("Execution task terminated unexpectedly taskId=%s attemptId=%s", *key)

    async def _execute(
        self,
        task: ComputeTask,
        cancellation: asyncio.Event,
        existing_handle: str | None = None,
    ) -> None:
        async with self._semaphore:
            # Check cancel_requested before starting
            if cancellation.is_set() or await self._journal.is_cancel_requested(
                task.task_id, task.attempt_id
            ):
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                canceled = ComputeObservation(
                    task_id=task.task_id,
                    attempt_id=task.attempt_id,
                    state=ExecutionState.CANCELED,
                    sequence=next_seq,
                    observed_at=self._now_fn(),
                    execution_handle=existing_handle,
                )
                await self._journal.update(canceled)
                return

            current_obs = await self._journal.load(task.task_id, task.attempt_id)
            if current_obs is None or current_obs.state != ExecutionState.RUNNING:
                next_seq = (current_obs.sequence + 1) if current_obs is not None else 1
                running = ComputeObservation(
                    task_id=task.task_id,
                    attempt_id=task.attempt_id,
                    state=ExecutionState.RUNNING,
                    sequence=next_seq,
                    observed_at=self._now_fn(),
                    execution_handle=existing_handle,
                )
                await self._journal.update(running)
            try:
                executor = self._executor_catalog.resolve(task)

                # Compute effective timeout
                now = self._now_fn()
                deadline_remaining = (task.constraints.deadline - now).total_seconds()
                effective_timeout = min(
                    float(task.constraints.max_runtime_seconds),
                    max(0.0, deadline_remaining),
                )

                async def save_submitting() -> None:
                    await self._journal.mark_submitting(task.task_id, task.attempt_id)

                async def save_handle(handle: str) -> None:
                    await self._journal.mark_submitted(task.task_id, task.attempt_id, handle)

                context = ExecutionContext(
                    existing_execution_handle=existing_handle,
                    save_handle=save_handle,
                    save_submitting=save_submitting,
                    correlation_key=f"{task.task_id}:{task.attempt_id}",
                )

                requirement = getattr(
                    executor,
                    "runtime_requirement",
                    RuntimeRequirement(family=RuntimeFamily.NONE, exclusive=False),
                )
                async with asyncio.timeout(effective_timeout):
                    async with self._residency.acquire(requirement):
                        result = await executor.execute(task, cancellation, context)

                state = (
                    ExecutionState.CANCELED
                    if (
                        cancellation.is_set()
                        or await self._journal.is_cancel_requested(task.task_id, task.attempt_id)
                    )
                    else ExecutionState.SUCCEEDED
                )
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                completed = ComputeObservation(
                    task_id=task.task_id,
                    attempt_id=task.attempt_id,
                    state=state,
                    sequence=next_seq,
                    observed_at=self._now_fn(),
                    execution_handle=result.execution_handle or existing_handle,
                    progress=1 if state == ExecutionState.SUCCEEDED else None,
                    outputs=result.outputs,
                    metrics=result.metrics,
                )
            except ExecutionCanceledError:
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                current_obs = await self._journal.load(task.task_id, task.attempt_id)
                handle = (current_obs.execution_handle if current_obs else None) or existing_handle
                completed = ComputeObservation(
                    task_id=task.task_id,
                    attempt_id=task.attempt_id,
                    state=ExecutionState.CANCELED,
                    sequence=next_seq,
                    observed_at=self._now_fn(),
                    execution_handle=handle,
                )
            except asyncio.CancelledError:
                raise

            except TimeoutError:
                now = self._now_fn()
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                if now >= task.constraints.deadline:
                    completed = self._failure(
                        task,
                        "DEADLINE_EXCEEDED",
                        ErrorCategory.PERMANENT,
                        "Task deadline exceeded",
                        sequence=next_seq,
                    )
                else:
                    sub_state = await self._journal.load_submission_state(
                        task.task_id, task.attempt_id
                    )
                    if sub_state is not None and sub_state != SubmissionState.NOT_SUBMITTED:
                        await self._journal.mark_unknown(task.task_id, task.attempt_id)
                        completed = self._failure(
                            task,
                            "EXECUTION_TIMEOUT",
                            ErrorCategory.PERMANENT,
                            "Execution timed out after dispatch with ambiguous outcome",
                            sequence=next_seq,
                        )
                    else:
                        completed = self._failure(
                            task,
                            "EXECUTION_TIMEOUT",
                            ErrorCategory.TRANSIENT,
                            "Execution timed out",
                            sequence=next_seq,
                        )
            except AmbiguousOutcomeError as exc:
                await self._journal.mark_unknown(task.task_id, task.attempt_id)
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                completed = self._failure(
                    task,
                    "AMBIGUOUS_OUTCOME",
                    ErrorCategory.PERMANENT,
                    str(exc) or "External outcome ambiguous",
                    sequence=next_seq,
                )
            except MissingDurableContextError as exc:
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                completed = self._failure(
                    task,
                    "MISSING_DURABLE_CONTEXT",
                    ErrorCategory.TRANSIENT,
                    str(exc) or "Missing durable context",
                    sequence=next_seq,
                )
            except ExecutorNotSupportedError as exc:
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                completed = self._failure(
                    task,
                    "EXECUTION_UNAVAILABLE",
                    ErrorCategory.TRANSIENT,
                    str(exc) or "Executor unavailable",
                    sequence=next_seq,
                )
            except ResidencyTransitionError as exc:
                LOGGER.error(
                    "Residency transition failed taskId=%s attemptId=%s: %s",
                    task.task_id,
                    task.attempt_id,
                    exc,
                )
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                completed = self._failure(
                    task,
                    "RESIDENCY_TRANSITION_FAILED",
                    ErrorCategory.CAPACITY,
                    str(exc) or "Failed to acquire GPU runtime model residency",
                    sequence=next_seq,
                )
            except Exception:
                LOGGER.exception(
                    "Executor failed taskId=%s attemptId=%s", task.task_id, task.attempt_id
                )
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                sub_state = await self._journal.load_submission_state(task.task_id, task.attempt_id)
                if sub_state is not None and sub_state != SubmissionState.NOT_SUBMITTED:
                    await self._journal.mark_unknown(task.task_id, task.attempt_id)
                    completed = self._failure(
                        task,
                        "AMBIGUOUS_OUTCOME",
                        ErrorCategory.PERMANENT,
                        "Executor failed after dispatch with ambiguous outcome",
                        sequence=next_seq,
                    )
                else:
                    completed = self._failure(
                        task,
                        "EXECUTOR_FAILURE",
                        ErrorCategory.TRANSIENT,
                        "Executor failed safely",
                        sequence=next_seq,
                    )
            await self._journal.update(completed)

    def _failure(
        self,
        task: ComputeTask,
        code: str,
        category: ErrorCategory,
        message: str,
        sequence: int = 2,
    ) -> ComputeObservation:
        return ComputeObservation(
            task_id=task.task_id,
            attempt_id=task.attempt_id,
            state=ExecutionState.FAILED,
            sequence=sequence,
            observed_at=self._now_fn(),
            error=ComputeError(
                code=code,
                category=category,
                message=message,
                retry_after_seconds=None,
                details={},
            ),
        )


__all__ = ["ExecutionApplicationService"]
