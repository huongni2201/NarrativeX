from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from narrativex_gpu_worker.application.ports.journal import OutboxJournalPort
from narrativex_gpu_worker.application.ports.outbound import ComputeEventPublisherPort

LOGGER = logging.getLogger("narrativex.gpu_worker.outbox")

BACKOFF_DELAYS = [1, 2, 5, 10, 30, 60, 120, 300]


class OutboxDeliveryService:
    """Asynchronously drains the SQLite outbox, delivering events to the backend with backoff."""

    def __init__(
        self,
        journal: OutboxJournalPort,
        publisher: ComputeEventPublisherPort,
        poll_interval_seconds: float = 1.0,
    ) -> None:
        self._journal = journal
        self._publisher = publisher
        self._poll_interval = poll_interval_seconds
        self._task: asyncio.Task[None] | None = None
        self._stopped = False

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stopped = False
        self._task = asyncio.create_task(self._run(), name="outbox-delivery-worker")
        LOGGER.info("Outbox delivery service started")

    async def stop(self) -> None:
        self._stopped = True
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        LOGGER.info("Outbox delivery service stopped")

    async def deliver_pending_once(self, limit: int = 50) -> int:
        """Processes one batch of due pending outbox events. Returns count of delivered events."""
        now = datetime.now(UTC)
        events = await self._journal.fetch_pending_outbox_events(limit=limit, due_before=now)
        delivered_count = 0
        for event in events:
            if self._stopped:
                break
            event_id = event.event_id
            payload_json = event.payload_json
            success = await self._publisher.publish(payload_json)
            if success:
                await self._journal.mark_outbox_event_delivered(event_id, datetime.now(UTC))
                delivered_count += 1
                LOGGER.debug("Delivered outbox event %s", event_id)
            else:
                attempt_count = event.attempt_count + 1
                delay_idx = min(attempt_count, len(BACKOFF_DELAYS) - 1)
                delay_seconds = BACKOFF_DELAYS[delay_idx]
                next_attempt = datetime.now(UTC) + timedelta(seconds=delay_seconds)
                await self._journal.record_outbox_delivery_failure(
                    event_id, next_attempt
                )
                LOGGER.warning(
                    "Outbox event %s delivery failed (attempt %d); retrying in %ds",
                    event_id,
                    attempt_count,
                    delay_seconds,
                )
        return delivered_count

    async def _run(self) -> None:
        while not self._stopped:
            try:
                await self.deliver_pending_once()
            except asyncio.CancelledError:
                break
            except Exception:
                LOGGER.exception("Unexpected error in outbox delivery loop")
            try:
                await asyncio.sleep(self._poll_interval)
            except asyncio.CancelledError:
                break


__all__ = ["BACKOFF_DELAYS", "OutboxDeliveryService"]
