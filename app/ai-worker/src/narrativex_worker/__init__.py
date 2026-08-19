"""NarrativeX AI Worker Foundation."""

__version__ = "0.1.0"

# Keep worker wiring stable while replacing only storyboard materialization semantics.
# Importing the package patches the repository symbol before narrativex_worker.worker imports it.
from narrativex_worker import repository as _repository
from narrativex_worker.revision_repository import RevisionAwareWorkerRepository

_repository.WorkerRepository = RevisionAwareWorkerRepository
