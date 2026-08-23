"""Render artifact persistence seam."""

from narrativex_worker.rendering.repository.implementation import RenderRepositoryImplementation


class RenderArtifactsRepository(RenderRepositoryImplementation):
    """Internal seam for immutable media asset persistence."""
