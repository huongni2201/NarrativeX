"""Claim and lease operations exposed by the render repository facade."""

from narrativex_worker.rendering.repository.implementation import RenderRepositoryImplementation


class RenderClaimsRepository(RenderRepositoryImplementation):
    """Internal seam for claim/lease behavior; kept separate for focused tests."""
