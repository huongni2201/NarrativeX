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
    ExecutorExecutionError,
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
            if submission_state != SubmissionState.NOT_SUBMITTED:
                if not execution_handle and not cancel_requested:
                    execution_handle = await self._recover_handle(task)
                if execution_handle and not cancel_requested:
                    self._schedule(task, existing_handle=execution_handle)
                else:
                    await self._journal.update(await self._hold_unknown(task))
            elif cancel_requested:
                await self._journal.update(
                    ComputeObservation(
                        task_id=task.task_id,
                        attempt_id=task.attempt_id,
                        state=ExecutionState.CANCELED,
                        sequence=next_seq,
                        observed_at=now,
                    )
                )
            elif task.constraints.deadline <= now:
                failed = self._failure(
                    task,
                    "DEADLINE_EXCEEDED",
                    ErrorCategory.PERMANENT,
                    "Task deadline expired before recovery",
                    sequence=next_seq,
                )
                await self._journal.update(failed)
            else:
                self._schedule(task, existing_handle=None)

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
            held = sum(
                state.is_ambiguous and (pending.task_id, pending.attempt_id) not in self._active
                for pending, _, _, state in await self._journal.recoverable()
            )
            if len(self._active) + held >= self._max_concurrency:
                raise CapacityError("worker capacity exhausted")
            try:
                observation, _ = await self._journal.save_accepted(task)
            except ValueError as exc:
                raise FingerprintConflictError from exc
            self._schedule(task)
            return observation

    async def get(self, task_id: UUID, attempt_id: UUID) -> ComputeObservation | None:
        observation = await self._journal.load(task_id, attempt_id)
        if (
            observation is not None
            and observation.state == ExecutionState.RUNNING
            and observation.error is not None
            and observation.error.code == "AMBIGUOUS_OUTCOME"
        ):
            async with self._admission_lock:
                if (
                    task_id,
                    attempt_id,
                ) not in self._active and not await self._journal.is_cancel_requested(
                    task_id, attempt_id
                ):
                    task = await self._journal.load_task(task_id, attempt_id)
                    if task is not None:
                        handle = observation.execution_handle or await self._recover_handle(task)
                        if handle is None:
                            return observation
                        try:
                            self._executor_catalog.resolve(task)
                        except ExecutorNotSupportedError:
                            return observation
                        self._schedule(task, existing_handle=handle)
        return observation

    async def _recover_handle(self, task: ComputeTask) -> str | None:
        lookup = getattr(self._executor_catalog, "recover_handle", None)
        if lookup is None:
            return None
        try:
            handle: str | None = await lookup(task)
        except Exception:
            return None
        if handle:
            await self._journal.mark_submitted(task.task_id, task.attempt_id, handle)
        return handle

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
                checkpoint = await self._journal.load_submission_state(
                    task.task_id, task.attempt_id
                )
                if checkpoint != SubmissionState.NOT_SUBMITTED:
                    await self._journal.update(await self._hold_unknown(task))
                    return
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
                effective_timeout = (
                    float(task.constraints.max_runtime_seconds)
                    if existing_handle
                    else min(
                        float(task.constraints.max_runtime_seconds), max(0.0, deadline_remaining)
                    )
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
                sub_state = await self._journal.load_submission_state(task.task_id, task.attempt_id)
                if sub_state != SubmissionState.NOT_SUBMITTED:
                    completed = await self._hold_unknown(task)
                elif now >= task.constraints.deadline:
                    completed = self._failure(
                        task,
                        "DEADLINE_EXCEEDED",
                        ErrorCategory.PERMANENT,
                        "Task deadline exceeded",
                        sequence=next_seq,
                    )
                else:
                    completed = self._failure(
                        task,
                        "EXECUTION_TIMEOUT",
                        ErrorCategory.TRANSIENT,
                        "Execution timed out before external submission",
                        sequence=next_seq,
                    )
            except AmbiguousOutcomeError:
                completed = await self._hold_unknown(task)
            except MissingDurableContextError as exc:
                completed = await self._failure_before_submission(
                    task,
                    "MISSING_DURABLE_CONTEXT",
                    ErrorCategory.TRANSIENT,
                    str(exc) or "Missing durable context",
                )
            except ExecutorNotSupportedError as exc:
                completed = await self._failure_before_submission(
                    task,
                    "EXECUTION_UNAVAILABLE",
                    ErrorCategory.TRANSIENT,
                    str(exc) or "Executor unavailable",
                )
            except ResidencyTransitionError as exc:
                LOGGER.warning(
                    "Residency transition failed taskId=%s attemptId=%s",
                    task.task_id,
                    task.attempt_id,
                )
                completed = await self._failure_before_submission(
                    task,
                    "RESIDENCY_TRANSITION_FAILED",
                    ErrorCategory.CAPACITY,
                    str(exc) or "Failed to acquire GPU runtime model residency",
                )
            except ExecutorExecutionError as exc:
                LOGGER.warning(
                    "Executor execution error taskId=%s attemptId=%s code=%s",
                    task.task_id,
                    task.attempt_id,
                    exc.code,
                )
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                category = (
                    ErrorCategory(exc.category) if isinstance(exc.category, str) else exc.category
                )
                completed = self._failure(
                    task,
                    exc.code,
                    category,
                    str(exc) or "Executor execution failed",
                    sequence=next_seq,
                )
            except Exception:
                LOGGER.warning(
                    "Executor raised unexpectedly taskId=%s attemptId=%s",
                    task.task_id,
                    task.attempt_id,
                )
                next_seq = await self._next_sequence(task.task_id, task.attempt_id)
                sub_state = await self._journal.load_submission_state(task.task_id, task.attempt_id)
                if sub_state is not None and sub_state != SubmissionState.NOT_SUBMITTED:
                    completed = await self._hold_unknown(task)
                else:
                    completed = self._failure(
                        task,
                        "EXECUTOR_FAILURE",
                        ErrorCategory.TRANSIENT,
                        "Executor failed safely",
                        sequence=next_seq,
                    )
            await self._journal.update(completed)

    async def _failure_before_submission(
        self, task: ComputeTask, code: str, category: ErrorCategory, message: str
    ) -> ComputeObservation:
        checkpoint = await self._journal.load_submission_state(task.task_id, task.attempt_id)
        if checkpoint != SubmissionState.NOT_SUBMITTED:
            return await self._hold_unknown(task)
        return self._failure(
            task,
            code,
            category,
            message,
            sequence=await self._next_sequence(task.task_id, task.attempt_id),
        )

    async def _hold_unknown(self, task: ComputeTask) -> ComputeObservation:
        current = await self._journal.load(task.task_id, task.attempt_id)
        if current is None:
            raise LookupError("attempt not found")
        if current.state in {
            ExecutionState.SUCCEEDED,
            ExecutionState.FAILED,
            ExecutionState.CANCELED,
        }:
            return current
        await self._journal.mark_unknown(task.task_id, task.attempt_id)
        return ComputeObservation(
            task_id=task.task_id,
            attempt_id=task.attempt_id,
            state=ExecutionState.RUNNING,
            sequence=current.sequence + 1,
            observed_at=self._now_fn(),
            execution_handle=current.execution_handle,
            error=ComputeError(
                code="AMBIGUOUS_OUTCOME",
                category=ErrorCategory.TRANSIENT,
                message="External execution outcome is unresolved; reconciliation required",
                retry_after_seconds=None,
                details={},
            ),
        )

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
