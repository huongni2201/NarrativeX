"""Main entry point for running narrativex_worker."""

import argparse
import asyncio
import logging
import sys
from typing import Any

from narrativex_worker.config import WorkerSettings, get_settings
from narrativex_worker.image_generation_worker import ImageGenerationWorkerRunner
from narrativex_worker.media_validation_worker import MediaValidationWorkerRunner
from narrativex_worker.narration.local_runner import LocalOptimizedNarrationWorkerRunner
from narrativex_worker.rendering.worker import RenderWorkerRunner
from narrativex_worker.translation_worker import TranslationWorkerRunner
from narrativex_worker.worker import NarrativeXWorker


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
    # Selected workers share one process-wide provider budget. Heavy providers are only
    # instantiated when their role is hosted by this process, allowing narration/rendering to be
    # deployed and scaled independently from provider-facing AI workers.
    concurrency_gate = asyncio.Semaphore(settings.worker_concurrency)
    workers: dict[str, Any] = {}

    if settings.has_worker_role("analysis"):
        workers["analysis"] = NarrativeXWorker(
            settings=settings, concurrency_gate=concurrency_gate
        )
    if settings.has_worker_role("translation"):
        workers["translation"] = TranslationWorkerRunner(
            settings=settings, concurrency_gate=concurrency_gate
        )
    if settings.has_worker_role("narration"):
        narration_worker = LocalOptimizedNarrationWorkerRunner(
            settings=settings, concurrency_gate=concurrency_gate
        )
        if narration_worker.enabled:
            workers["narration"] = narration_worker
    if settings.has_worker_role("media-validation"):
        media_validation_worker = MediaValidationWorkerRunner(
            settings=settings, concurrency_gate=concurrency_gate
        )
        if media_validation_worker.enabled:
            workers["media-validation"] = media_validation_worker
    if settings.has_worker_role("image-generation"):
        image_worker = ImageGenerationWorkerRunner(
            settings=settings, concurrency_gate=concurrency_gate
        )
        if image_worker.enabled:
            workers["image-generation"] = image_worker
    if settings.has_worker_role("render"):
        render_worker = RenderWorkerRunner(
            settings=settings, concurrency_gate=concurrency_gate
        )
        if render_worker.enabled:
            workers["render"] = render_worker

    if not workers:
        raise RuntimeError("No enabled workers remain after applying WORKER_ROLES/provider modes")

    logging.getLogger("narrativex.worker").info(
        "Starting worker roles=%s", ",".join(sorted(workers))
    )
    if dry_run:
        await asyncio.gather(*(worker.start(dry_run=True) for worker in workers.values()))
        return

    tasks = {name: asyncio.create_task(worker.start()) for name, worker in workers.items()}
    try:
        done, _ = await asyncio.wait(
            tasks.values(),
            return_when=asyncio.FIRST_COMPLETED,
        )
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


def main() -> None:
    args = parse_args()
    settings = get_settings()
    setup_logging(settings.log_level)
    try:
        asyncio.run(run_workers(settings, dry_run=args.dry_run))
    except KeyboardInterrupt:
        return
    except Exception:
        logging.getLogger("narrativex.worker").exception("Worker supervisor failed")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
