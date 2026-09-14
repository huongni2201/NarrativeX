"""Compatibility imports for the HTTP artifact adapter."""

from narrativex_gpu_worker.adapters.artifacts.http import (
    ArtifactIntegrityError,
    HttpArtifactAdapter,
)

ArtifactClient = HttpArtifactAdapter

__all__ = ["ArtifactClient", "ArtifactIntegrityError"]
