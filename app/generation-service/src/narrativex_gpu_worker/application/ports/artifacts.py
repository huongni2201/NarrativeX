from __future__ import annotations

from typing import Protocol

from narrativex_gpu_worker.contracts import (
    InputArtifactRef,
    OutputArtifactTarget,
    ProducedArtifact,
)


class ArtifactPort(Protocol):
    """Capability-based byte transport used by executor adapters."""

    async def download(self, reference: InputArtifactRef) -> bytes: ...

    async def upload(self, target: OutputArtifactTarget, content: bytes) -> ProducedArtifact: ...
