"""Production worker wiring for revision-aware storyboard materialization."""

from narrativex_worker.config import WorkerSettings
from narrativex_worker.revision_repository import RevisionAwareWorkerRepository
from narrativex_worker.worker import NarrativeXWorker


class RevisionAwareNarrativeXWorker(NarrativeXWorker):
    def __init__(self, settings: WorkerSettings | None = None) -> None:
        super().__init__(settings=settings)
        self.repository = RevisionAwareWorkerRepository(
            database_url=self.settings.database_url,
            lease_seconds=self.settings.lease_seconds,
            pool_size=max(5, self.settings.worker_concurrency * 2 + 1),
        )
