"""Typed failure categories for the durable narration pipeline."""

import asyncio
import uuid
from collections.abc import Awaitable, Callable

import asyncpg  # type: ignore[import-untyped]
from botocore.exceptions import BotoCoreError, ClientError  # type: ignore[import-untyped]

from narrativex_worker.runtime.retry_policy import (
    LOCAL_IO_RETRY_POLICY,
    UNKNOWN_RECONCILIATION_POLICY,
    RetryPolicy,
)


class NarrationError(RuntimeError):
    """Base class for failures whose state semantics are known to the worker."""


class NarrationPermanentError(NarrationError):
    """The request or deterministic result is invalid and must not be retried."""


class NarrationOutcomeUnknownError(NarrationError):
    """The provider may have accepted the request; automatic resubmission is forbidden."""

    def __init__(
        self,
        message: str,
        *,
        provider_operation_id: uuid.UUID | None = None,
        storage_key: str | None = None,
        reconciliation_exhausted: bool = False,
    ) -> None:
        super().__init__(message)
        self.provider_operation_id = provider_operation_id
        self.storage_key = storage_key
        self.reconciliation_exhausted = reconciliation_exhausted


class NarrationRetryableInfrastructureError(NarrationError):
    """A temporary local, database, media, or storage failure safe to retry."""


class NarrationLeaseLostError(NarrationError):
    """The worker no longer owns the StageAttempt lease."""


def narration_reconcile_delay_seconds(attempt: int) -> int:
    """Return deterministic exponential backoff for an UNKNOWN operation."""
    return int(UNKNOWN_RECONCILIATION_POLICY.delay_seconds(attempt))


def is_transient_infrastructure_error(exception: BaseException) -> bool:
    """Classify only errors that can safely be retried without invoking the provider."""
    if isinstance(
        exception,
        (
            NarrationError,
            ValueError,
            KeyError,
            asyncpg.PostgresSyntaxError,
            asyncpg.UndefinedTableError,
            asyncpg.UndefinedColumnError,
        ),
    ):
        return isinstance(exception, NarrationRetryableInfrastructureError)
    if isinstance(exception, (asyncpg.PostgresConnectionError, asyncpg.InterfaceError)):
        return True
    if isinstance(exception, asyncpg.PostgresError):
        return exception.sqlstate in {
            "40001",  # serialization_failure
            "40P01",  # deadlock_detected
            "55P03",  # lock_not_available
            "53300",  # too_many_connections
        }
    if isinstance(exception, BotoCoreError):
        return True
    if isinstance(exception, ClientError):
        status = exception.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        return status is None or int(status) == 429 or int(status) >= 500
    return isinstance(exception, (TimeoutError, ConnectionError, OSError))


async def retry_local_io[T](
    operation: Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
) -> T:
    """Retry bounded local/storage/DB I/O without ever retrying provider calls."""
    if attempts < 1:
        raise ValueError("attempts must be positive")
    policy = _local_io_policy(attempts)
    for attempt in range(attempts):
        try:
            return await operation()
        except Exception as exception:
            if not is_transient_infrastructure_error(exception) or attempt == attempts - 1:
                raise
            await asyncio.sleep(policy.delay_seconds(attempt))
    raise AssertionError("retry_local_io exhausted without returning or raising")


def _local_io_policy(attempts: int) -> RetryPolicy:
    """Preserve the local I/O contract while allowing callers to cap attempts."""
    if attempts < 1:
        raise ValueError("attempts must be positive")
    return type(LOCAL_IO_RETRY_POLICY)(
        max_attempts=attempts,
        base_delay_seconds=LOCAL_IO_RETRY_POLICY.base_delay_seconds,
        multiplier=LOCAL_IO_RETRY_POLICY.multiplier,
        max_delay_seconds=LOCAL_IO_RETRY_POLICY.max_delay_seconds,
    )
