"""Main entry point for running narrativex_worker."""

import argparse
import asyncio
import logging
import sys
from typing import Any
from urllib.parse import urlsplit

from narrativex_worker.config import WorkerSettings, get_settings
from narrativex_worker.health import WorkerHealthServer
from narrativex_worker.runtime_files import validate_runtime_files


def setup_logging(level_name: str) -> None:
    numeric_level = getattr(logging, level_name.upper(), logging.INFO)
    logging.basicConfig(
        level=numeric_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
        force=True,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NarrativeX AI Worker")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Initialize, verify configuration, log readiness, and exit cleanly.",
    )
    return parser.parse_args()


async def run_workers(settings: WorkerSettings, *, dry_run: bool) -> None:
    concurrency_gate = asyncio.Semaphore(settings.worker_concurrency)
    workers: dict[str, Any] = {}

    if settings.has_worker_role("analysis"):
        from narrativex_worker.worker import NarrativeXWorker

        workers["analysis"] = NarrativeXWorker(settings=settings, concurrency_gate=concurrency_gate)
    if settings.has_worker_role("narration"):
        from narrativex_worker.narration.local_runner import LocalOptimizedNarrationWorkerRunner

        narration_worker = LocalOptimizedNarrationWorkerRunner(
            settings=settings, concurrency_gate=concurrency_gate
        )
        if narration_worker.enabled:
            workers["narration"] = narration_worker
    if settings.has_worker_role("media-validation"):
        from narrativex_worker.media_validation_worker import MediaValidationWorkerRunner

        media_validation_worker = MediaValidationWorkerRunner(
            settings=settings, concurrency_gate=concurrency_gate
        )
        if media_validation_worker.enabled:
            workers["media-validation"] = media_validation_worker
    if settings.has_worker_role("image-generation"):
        from narrativex_worker.image_generation_worker import ImageGenerationWorkerRunner

        image_worker = ImageGenerationWorkerRunner(
            settings=settings, concurrency_gate=concurrency_gate
        )
        if image_worker.enabled:
            workers["image-generation"] = image_worker

    if not workers:
        raise RuntimeError("No enabled workers remain after applying WORKER_ROLES/provider modes")

    logging.getLogger("narrativex.worker").info(
        "Starting worker roles=%s", ",".join(sorted(workers))
    )
    if dry_run:
        await asyncio.gather(*(worker.start(dry_run=True) for worker in workers.values()))
        return

    health_server = WorkerHealthServer(settings.database_url, settings.health_check_port)
    database_identity = await health_server.database_identity()
    if database_identity is None:
        raise RuntimeError("Worker startup database identity probe failed")
    database_host, database_port, database_name = _database_target(settings.database_url)
    provider = settings.tts_provider_mode if settings.has_worker_role("narration") else "n/a"
    logging.getLogger("narrativex.worker").info(
        "Worker database ready workerName=%s roles=%s provider=%s "
        "dbHost=%s dbPort=%s dbName=%s dbSchema=%s configuredDbName=%s buildSha=%s",
        settings.worker_name,
        ",".join(sorted(workers)),
        provider,
        database_host,
        database_port,
        database_identity[0],
        database_identity[1],
        database_name,
        settings.build_sha,
    )
    await health_server.start()
    tasks = {name: asyncio.create_task(worker.start()) for name, worker in workers.items()}
    try:
        done, _ = await asyncio.wait(tasks.values(), return_when=asyncio.FIRST_COMPLETED)
        for name, task in tasks.items():
            if task not in done:
                continue
            exception = task.exception()
            if exception is not None:
                raise RuntimeError(f"{name} worker failed") from exception
            raise RuntimeError(f"{name} worker exited unexpectedly")
    finally:
        for worker in workers.values():
            worker.stop()
        for task in tasks.values():
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks.values(), return_exceptions=True)
        await health_server.close()


def main() -> None:
    args = parse_args()
    settings = get_settings()
    setup_logging(settings.log_level)
    try:
        validate_runtime_files(settings)
        asyncio.run(run_workers(settings, dry_run=args.dry_run))
    except KeyboardInterrupt:
        return
    except Exception:
        logging.getLogger("narrativex.worker").exception("Worker supervisor failed")
        sys.exit(1)
    sys.exit(0)


def _database_target(database_url: str) -> tuple[str, int, str]:
    parsed = urlsplit(database_url)
    return (
        parsed.hostname or "unknown",
        parsed.port or 5432,
        parsed.path.lstrip("/") or "unknown",
    )


if __name__ == "__main__":
    main()
