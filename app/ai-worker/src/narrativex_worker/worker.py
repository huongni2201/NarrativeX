"""Worker lifecycle and process runner."""

import asyncio
import logging
import signal
import sys
from typing import Any

from narrativex_worker.config import WorkerSettings, get_settings


class NarrativeXWorker:
    """Core worker runner managing lifecycle and configuration."""

    def __init__(self, settings: WorkerSettings | None = None) -> None:
        self.settings = settings or get_settings()
        self._setup_logging()
        self._running = False

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
        """Start worker and log readiness."""
        self.logger.info(
            "Starting %s in %s mode (log_level=%s)",
            self.settings.worker_name,
            self.settings.worker_env,
            self.settings.log_level,
        )
        self.logger.info("NarrativeX AI Worker foundation is ready.")

        if dry_run:
            self.logger.info("Dry run completed successfully. Exiting.")
            return

        self._running = True
        loop = asyncio.get_running_loop()

        # Handle termination signals on supported platforms
        if sys.platform != "win32":
            for sig in (signal.SIGINT, signal.SIGTERM):
                loop.add_signal_handler(sig, self.stop)

        try:
            while self._running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            self.logger.info("Worker received cancellation. Shutting down.")
        finally:
            self.logger.info("Worker stopped cleanly.")

    def stop(self, *args: Any) -> None:
        """Signal worker to stop gracefully."""
        self.logger.info("Shutdown signal received.")
        self._running = False
