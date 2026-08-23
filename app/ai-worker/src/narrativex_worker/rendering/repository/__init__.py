"""Stable RenderRepository facade with role-oriented internal seams.

Consumers continue importing ``narrativex_worker.rendering.repository`` while
the implementation is organized under claims, inputs, artifacts, completion,
and models modules.
"""

from narrativex_worker.rendering.repository.implementation import (
    ClaimedRenderJob,
    RenderAudioAsset,
    RenderBeatAsset,
    RenderLeaseLostError,
    RenderRepositoryImplementation,
    RenderStateConflictError,
)


class RenderRepository(RenderRepositoryImplementation):
    """Public facade retained for worker and test consumers."""


__all__ = [
    "ClaimedRenderJob",
    "RenderAudioAsset",
    "RenderBeatAsset",
    "RenderLeaseLostError",
    "RenderRepository",
    "RenderStateConflictError",
]
