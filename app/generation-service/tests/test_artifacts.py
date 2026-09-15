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
from narrativex_gpu_worker.contracts import (
    ArtifactReadAccess,
    ArtifactWriteAccess,
    InputArtifactRef,
    OutputArtifactTarget,
)


def input_reference(content: bytes, *, digest: str | None = None) -> InputArtifactRef:
    return InputArtifactRef(
        artifact_id=uuid4(),
        role="source-audio",
        media_type="audio/wav",
        size_bytes=len(content),
        sha256=digest or hashlib.sha256(content).hexdigest(),
        access=ArtifactReadAccess(
            method="GET",
            url="https://artifact.invalid/capability",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
            headers={"X-Test": "1"},
        ),
    )


def output_target() -> OutputArtifactTarget:
    return OutputArtifactTarget(
        artifact_id=uuid4(),
        role="synthesized-audio",
        media_type="audio/wav",
        access=ArtifactWriteAccess(
            method="PUT",
            url="https://artifact.invalid/upload",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
            headers={"Authorization": "Bearer token"},
        ),
    )


async def test_download_verifies_size_and_digest() -> None:
    content = b"valid-audio"
    transport = httpx.MockTransport(lambda _request: httpx.Response(200, content=content))
    async with httpx.AsyncClient(transport=transport) as client:
        result = await HttpArtifactAdapter(client, 1024).download(input_reference(content))
    assert result == content


async def test_download_rejects_digest_mismatch() -> None:
    content = b"corrupt"
    transport = httpx.MockTransport(lambda _request: httpx.Response(200, content=content))
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(ArtifactIntegrityError, match="integrity"):
            await HttpArtifactAdapter(client, 1024).download(
                input_reference(content, digest="0" * 64)
            )


async def test_redirect_is_not_followed() -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(302, headers={"Location": "https://evil.invalid/"})
    )
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(httpx.HTTPStatusError):
            await HttpArtifactAdapter(client, 1024).download(input_reference(b"x"))


async def test_upload_calculates_digest_and_returns_produced_artifact() -> None:
    content = b"generated-audio-bytes"
    target = output_target()

    recorded_requests: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        recorded_requests.append(req)
        return httpx.Response(200)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        produced = await HttpArtifactAdapter(client, 1024).upload(target, content)

    assert len(recorded_requests) == 1
    assert recorded_requests[0].method == "PUT"
    assert recorded_requests[0].content == content
    assert recorded_requests[0].headers["authorization"] == "Bearer token"

    assert produced.artifact_id == target.artifact_id
    assert produced.role == target.role
    assert produced.media_type == target.media_type
    assert produced.size_bytes == len(content)
    assert produced.sha256 == hashlib.sha256(content).hexdigest()


async def test_upload_rejects_content_exceeding_worker_limit() -> None:
    content = b"a" * 100
    target = output_target()
    transport = httpx.MockTransport(lambda _req: httpx.Response(200))
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(ArtifactIntegrityError, match="exceeds worker limit"):
            await HttpArtifactAdapter(client, 50).upload(target, content)
