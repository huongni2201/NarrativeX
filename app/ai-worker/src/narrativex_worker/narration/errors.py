"""Typed failure categories for the durable narration pipeline."""

import asyncio
import uuid
from collections.abc import Awaitable, Callable

import asyncpg  # type: ignore[import-untyped]
from botocore.exceptions import BotoCoreError, ClientError  # type: ignore[import-untyped]


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
    if attempt < 0:
        raise ValueError("reconciliation attempt must be non-negative")
    return min(300, 5 * int(2**attempt))


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
    delays = (0.25, 1.0, 2.0)
    for attempt in range(attempts):
        try:
            return await operation()
        except Exception as exception:
            if not is_transient_infrastructure_error(exception) or attempt == attempts - 1:
                raise
            await asyncio.sleep(delays[min(attempt, len(delays) - 1)])
    raise AssertionError("retry_local_io exhausted without returning or raising")
