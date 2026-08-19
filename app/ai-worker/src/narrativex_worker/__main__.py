"""Main entry point for running narrativex_worker."""

import argparse
import asyncio
import sys

from narrativex_worker.config import get_settings
from narrativex_worker.revision_worker import RevisionAwareNarrativeXWorker


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="NarrativeX AI Worker")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Initialize, verify configuration, log readiness, and exit cleanly.",
    )
    return parser.parse_args()


def main() -> None:
    """Execute main worker process."""
    args = parse_args()
    settings = get_settings()
    worker = RevisionAwareNarrativeXWorker(settings=settings)

    try:
        asyncio.run(worker.start(dry_run=args.dry_run))
    except KeyboardInterrupt:
        pass
    sys.exit(0)


if __name__ == "__main__":
    main()
