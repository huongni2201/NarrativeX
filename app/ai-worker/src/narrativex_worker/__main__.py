"""Main entry point for running narrativex_worker."""

import argparse
import asyncio
import sys

from narrativex_worker.config import WorkerSettings, get_settings
from narrativex_worker.narration.runner import NarrationWorkerRunner
from narrativex_worker.worker import NarrativeXWorker


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
    narration_worker = NarrationWorkerRunner(settings=settings, concurrency_gate=concurrency_gate)
    if dry_run:
        await analysis_worker.start(dry_run=True)
        await narration_worker.start(dry_run=True)
        return

    analysis_task = asyncio.create_task(analysis_worker.start())
    if not narration_worker.enabled:
        await analysis_task
        return

    narration_task = asyncio.create_task(narration_worker.start())
    try:
        done, _ = await asyncio.wait(
            {analysis_task, narration_task}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in done:
            await task
        if narration_task in done and analysis_worker._running:
            raise RuntimeError("Narration worker stopped unexpectedly")
    finally:
        analysis_worker.stop()
        narration_worker.stop()
        for task in (analysis_task, narration_task):
            if not task.done():
                task.cancel()
        await asyncio.gather(analysis_task, narration_task, return_exceptions=True)


def main() -> None:
    args = parse_args()
    settings = get_settings()
    try:
        asyncio.run(run_workers(settings, dry_run=args.dry_run))
    except KeyboardInterrupt:
        pass
    sys.exit(0)


if __name__ == "__main__":
    main()
