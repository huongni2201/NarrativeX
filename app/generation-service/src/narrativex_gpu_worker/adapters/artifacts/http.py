from __future__ import annotations

import hashlib

import httpx

from narrativex_gpu_worker.contracts import (
    InputArtifactRef,
    OutputArtifactTarget,
    ProducedArtifact,
)


class ArtifactIntegrityError(ValueError):
    """An artifact capability or its bytes failed a local safety check."""


class HttpArtifactAdapter:
    """Capability-based HTTP adapter for provider input/output bytes."""

    def __init__(self, client: httpx.AsyncClient, max_artifact_bytes: int) -> None:
        self._client = client
        self._max_artifact_bytes = max_artifact_bytes

    async def download(self, reference: InputArtifactRef) -> bytes:
        if reference.access.method != "GET":
            raise ArtifactIntegrityError("input artifact does not grant GET access")
        if reference.size_bytes > self._max_artifact_bytes:
            raise ArtifactIntegrityError("artifact exceeds worker limit")
        async with self._client.stream(
            "GET",
            str(reference.access.url),
            headers=reference.access.headers,
            follow_redirects=False,
        ) as response:
            response.raise_for_status()
            chunks: list[bytes] = []
            received = 0
            digest = hashlib.sha256()
            async for chunk in response.aiter_bytes():
                received += len(chunk)
                if received > min(reference.size_bytes, self._max_artifact_bytes):
                    raise ArtifactIntegrityError("artifact size does not match reference")
                digest.update(chunk)
                chunks.append(chunk)
        if received != reference.size_bytes or digest.hexdigest() != reference.sha256:
            raise ArtifactIntegrityError("artifact integrity check failed")
        return b"".join(chunks)

    async def upload(self, target: OutputArtifactTarget, content: bytes) -> ProducedArtifact:
        if target.access.method != "PUT":
            raise ArtifactIntegrityError("output artifact does not grant PUT access")
        if len(content) > self._max_artifact_bytes:
            raise ArtifactIntegrityError("output artifact exceeds worker limit")
        size_bytes = len(content)
        sha256 = hashlib.sha256(content).hexdigest()
        response = await self._client.put(
            str(target.access.url),
            headers=target.access.headers,
            content=content,
            follow_redirects=False,
        )
        response.raise_for_status()
        return ProducedArtifact(
            artifact_id=target.artifact_id,
            role=target.role,
            media_type=target.media_type,
            size_bytes=size_bytes,
            sha256=sha256,
        )


__all__ = ["ArtifactIntegrityError", "HttpArtifactAdapter"]
