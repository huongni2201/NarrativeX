"""Render completion and terminal-state seam."""

from narrativex_worker.rendering.repository.implementation import RenderRepositoryImplementation


class RenderCompletionRepository(RenderRepositoryImplementation):
    """Internal seam for completion, stalled, and failure transitions."""
