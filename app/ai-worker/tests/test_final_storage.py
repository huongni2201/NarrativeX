from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from narrativex_worker.rendering.final_storage import (
    FinalVideoStorageError,
    GoogleDriveFinalVideoStorage,
    GoogleDriveSettings,
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
