import logging
from pathlib import Path
from typing import cast
from unittest.mock import AsyncMock

import httpx
import pytest

from narrativex_worker.rendering import final_storage
from narrativex_worker.rendering.final_storage import (
    FinalVideoStorageError,
    GoogleDriveFinalVideoStorage,
    GoogleDriveSettings,
    _UploadMetrics,
)


def _storage() -> GoogleDriveFinalVideoStorage:
    return GoogleDriveFinalVideoStorage(
        GoogleDriveSettings(
            client_id="client",
            client_secret="secret",
            refresh_token="refresh",
            folder_id="folder",
        )
    )


@pytest.mark.asyncio
async def test_put_immutable_reuses_drive_file_only_when_sha_matches(tmp_path: Path) -> None:
    file_path = tmp_path / "render.mp4"
    file_path.write_bytes(b"abcd")
    storage = _storage()
    storage._access_token = AsyncMock(return_value="token")  # type: ignore[method-assign]
    storage._find_existing = AsyncMock(  # type: ignore[method-assign]
        return_value={
            "id": "file-1",
            "size": "4",
            "webViewLink": "https://drive.example/file-1",
            "appProperties": {
                "narrativexRenderFingerprint": "fingerprint",
                "narrativexSha256": "a" * 64,
            },
        }
    )

    asset = await storage.put_immutable(
        file_path=file_path,
        render_fingerprint="fingerprint",
        checksum="a" * 64,
        generation_job_id=7,
    )

    assert asset.external_file_id == "file-1"
    assert asset.checksum == "a" * 64


@pytest.mark.asyncio
async def test_put_immutable_logs_upload_metrics(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    file_path = tmp_path / "render.mp4"
    file_path.write_bytes(b"abcd")
    storage = _storage()
    storage._access_token = AsyncMock(return_value="token")  # type: ignore[method-assign]
    storage._find_existing = AsyncMock(return_value=None)  # type: ignore[method-assign]
    storage._start_resumable_upload = AsyncMock(  # type: ignore[method-assign]
        return_value="https://upload.example/session"
    )

    async def upload_chunks(*args: object, **kwargs: object) -> dict[str, object]:
        metrics = cast(_UploadMetrics, kwargs["metrics"])
        metrics.resume_count = 2
        metrics.drive_http_retries = 3
        return {"id": "file-1"}

    storage._upload_chunks = upload_chunks  # type: ignore[method-assign]
    storage._get_file = AsyncMock(  # type: ignore[method-assign]
        return_value={
            "id": "file-1",
            "size": "4",
            "appProperties": {"narrativexSha256": "a" * 64},
        }
    )

    with caplog.at_level(logging.INFO, logger="narrativex.worker.render.final-storage"):
        await storage.put_immutable(
            file_path=file_path,
            render_fingerprint="fingerprint",
            checksum="a" * 64,
            generation_job_id=7,
        )

    message = next(
        record.message for record in caplog.records if record.name.endswith("final-storage")
    )
    assert "outcome=uploaded" in message
    assert "upload_duration_seconds=" in message
    assert "uploaded_bytes=4" in message
    assert "resume_count=2" in message
    assert "drive_http_retries=3" in message


@pytest.mark.asyncio
async def test_upload_chunks_tracks_timeout_resume_metrics(tmp_path: Path, monkeypatch) -> None:
    file_path = tmp_path / "render.mp4"
    file_path.write_bytes(b"abcd")
    storage = _storage()
    requests: list[str] = []

    class FakeClient:
        def __init__(self, **kwargs: object) -> None:
            del kwargs

        async def __aenter__(self) -> "FakeClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def put(
            self, url: str, *, headers: dict[str, str], content: bytes | None = None
        ) -> httpx.Response:
            del url, content
            requests.append(headers["Content-Range"])
            if len(requests) == 1:
                raise httpx.ReadTimeout("transient")
            if headers["Content-Range"] == "bytes */4":
                return httpx.Response(308, headers={"Range": "bytes=0-1"})
            return httpx.Response(200, json={"id": "file-1"})

    monkeypatch.setattr(final_storage.httpx, "AsyncClient", FakeClient)
    metrics = _UploadMetrics()

    result = await storage._upload_chunks(
        "token", "https://upload.example/session", file_path, 4, metrics=metrics
    )

    assert result == {"id": "file-1"}
    assert requests == ["bytes 0-3/4", "bytes */4", "bytes 2-3/4"]
    assert metrics.uploaded_bytes == 4
    assert metrics.resume_count == 1
    assert metrics.drive_http_retries == 1


@pytest.mark.asyncio
async def test_put_immutable_rejects_same_size_different_sha(tmp_path: Path) -> None:
    file_path = tmp_path / "render.mp4"
    file_path.write_bytes(b"abcd")
    storage = _storage()
    storage._access_token = AsyncMock(return_value="token")  # type: ignore[method-assign]
    storage._find_existing = AsyncMock(  # type: ignore[method-assign]
        return_value={
            "id": "file-1",
            "size": "4",
            "appProperties": {
                "narrativexRenderFingerprint": "fingerprint",
                "narrativexSha256": "b" * 64,
            },
        }
    )

    with pytest.raises(FinalVideoStorageError, match="different immutable content"):
        await storage.put_immutable(
            file_path=file_path,
            render_fingerprint="fingerprint",
            checksum="a" * 64,
            generation_job_id=7,
        )


@pytest.mark.asyncio
async def test_put_immutable_rejects_existing_file_without_sha_metadata(tmp_path: Path) -> None:
    file_path = tmp_path / "render.mp4"
    file_path.write_bytes(b"abcd")
    storage = _storage()
    storage._access_token = AsyncMock(return_value="token")  # type: ignore[method-assign]
    storage._find_existing = AsyncMock(  # type: ignore[method-assign]
        return_value={"id": "file-1", "size": "4", "appProperties": {}}
    )

    with pytest.raises(FinalVideoStorageError, match="different immutable content"):
        await storage.put_immutable(
            file_path=file_path,
            render_fingerprint="fingerprint",
            checksum="a" * 64,
            generation_job_id=7,
        )
