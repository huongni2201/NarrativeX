from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest

from narrativex_gpu_worker.adapters.artifacts.http import (
    ArtifactIntegrityError,
    HttpArtifactAdapter,
)
from narrativex_gpu_worker.contracts import ArtifactAccess, ArtifactRef


def reference(content: bytes, *, digest: str | None = None, method: str = "GET") -> ArtifactRef:
    return ArtifactRef(
        artifactId=uuid4(),
        role="source-audio",
        mediaType="audio/wav",
        sizeBytes=len(content),
        sha256=digest or hashlib.sha256(content).hexdigest(),
        access=ArtifactAccess(
            method=method,
            url="https://artifact.invalid/capability",
            expiresAt=datetime.now(UTC) + timedelta(minutes=5),
            headers={},
        ),
    )


async def test_download_verifies_size_and_digest() -> None:
    content = b"valid-audio"
    transport = httpx.MockTransport(lambda _request: httpx.Response(200, content=content))
    async with httpx.AsyncClient(transport=transport) as client:
        result = await HttpArtifactAdapter(client, 1024).download(reference(content))
    assert result == content


async def test_download_rejects_digest_mismatch() -> None:
    content = b"corrupt"
    transport = httpx.MockTransport(lambda _request: httpx.Response(200, content=content))
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(ArtifactIntegrityError, match="integrity"):
            await HttpArtifactAdapter(client, 1024).download(reference(content, digest="0" * 64))


async def test_redirect_is_not_followed() -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(302, headers={"Location": "https://evil.invalid/"})
    )
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(httpx.HTTPStatusError):
            await HttpArtifactAdapter(client, 1024).download(reference(b"x"))
