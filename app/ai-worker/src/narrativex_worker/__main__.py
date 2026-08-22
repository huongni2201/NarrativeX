"""Main entry point for running narrativex_worker."""

import argparse
import asyncio
import logging
import sys
from typing import Any

from narrativex_worker.config import WorkerSettings, get_settings
from narrativex_worker.image_generation_worker import ImageGenerationWorkerRunner
from narrativex_worker.media_validation_worker import MediaValidationWorkerRunner
from narrativex_worker.narration.runner import NarrationWorkerRunner
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
    # Both runners share one process-wide provider budget. Without this gate each runner could
    # independently consume max_concurrent_jobs, doubling provider pressure and DB work.
    concurrency_gate = asyncio.Semaphore(settings.worker_concurrency)
    analysis_worker = NarrativeXWorker(settings=settings, concurrency_gate=concurrency_gate)
    translation_worker = TranslationWorkerRunner(
        settings=settings, concurrency_gate=concurrency_gate
    )
    narration_worker = NarrationWorkerRunner(settings=settings, concurrency_gate=concurrency_gate)
    media_validation_worker = MediaValidationWorkerRunner(
        settings=settings, concurrency_gate=concurrency_gate
    )
    image_worker = ImageGenerationWorkerRunner(settings=settings, concurrency_gate=concurrency_gate)
    if dry_run:
        dry_run_workers: list[Any] = [analysis_worker, translation_worker]
        if narration_worker.enabled:
            dry_run_workers.append(narration_worker)
        if media_validation_worker.enabled:
            dry_run_workers.append(media_validation_worker)
        if image_worker.enabled:
            dry_run_workers.append(image_worker)
        await asyncio.gather(*(worker.start(dry_run=True) for worker in dry_run_workers))
        return

    workers: dict[str, Any] = {
        "analysis": analysis_worker,
        "translation": translation_worker,
    }
    if narration_worker.enabled:
        workers["narration"] = narration_worker
    if media_validation_worker.enabled:
        workers["media-validation"] = media_validation_worker
    if image_worker.enabled:
        workers["image-generation"] = image_worker
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
