"""Shared asyncio task lifecycle helpers for worker runners."""

import asyncio
import logging


def reap_finished_tasks(
    tasks: set[asyncio.Task[None]],
    logger: logging.Logger,
    *,
    worker_id: str,
    task_label: str,
) -> None:
    """Remove completed tasks and retrieve exceptions before they can leak."""
    finished = {task for task in tasks if task.done()}
    for task in finished:
        tasks.remove(task)
        if task.cancelled():
            continue
        exception = task.exception()
        if exception is not None:
            logger.error(
                "%s task ended unexpectedly workerId=%s",
                task_label,
                worker_id,
                exc_info=(type(exception), exception, exception.__traceback__),
            )
