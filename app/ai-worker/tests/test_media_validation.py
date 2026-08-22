import hashlib
from pathlib import Path

import pytest
from PIL import Image

from narrativex_worker.media_validation import MediaValidationError, validate_media_file
from narrativex_worker.narration.storage import (
    InMemoryMediaStorage,
    MediaAssetConflictError,
    MediaDownloadLimitError,
)


def test_valid_png_is_decoded_and_dimensions_are_persistable(tmp_path: Path) -> None:
    path = tmp_path / "object.bin"
    Image.new("RGB", (32, 16), "red").save(path, format="PNG")

    result = validate_media_file(path, "IMAGE", "image/png")

    assert result.detected_content_type == "image/png"
    assert result.detected_container == "png"
    assert (result.width, result.height) == (32, 16)


def test_text_disguised_as_png_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "voice.png"
    path.write_text("not an image", encoding="utf-8")

    with pytest.raises(MediaValidationError, match="IMAGE_DECODE_FAILED"):
        validate_media_file(path, "IMAGE", "image/png")


@pytest.mark.asyncio
async def test_download_stops_before_authorized_limit(tmp_path: Path) -> None:
    storage = InMemoryMediaStorage()
    content = b"x" * 2048
    checksum = hashlib.sha256(content).hexdigest()
    await storage.put_immutable(
        storage_key="media/uploads/internal",
        content=content,
        checksum=checksum,
        mime_type="application/octet-stream",
    )

    with pytest.raises(MediaDownloadLimitError):
        await storage.download_to_file(
            "media/uploads/internal",
            tmp_path / "object.bin",
            expected_size=len(content),
            expected_checksum=checksum,
            max_bytes=1024,
        )


@pytest.mark.asyncio
async def test_download_checksum_mismatch_is_rejected(tmp_path: Path) -> None:
    storage = InMemoryMediaStorage()
    content = b"actual"
    await storage.put_immutable(
        storage_key="media/uploads/internal",
        content=content,
        checksum=hashlib.sha256(content).hexdigest(),
        mime_type="audio/mpeg",
    )

    with pytest.raises(MediaAssetConflictError):
        await storage.download_to_file(
            "media/uploads/internal",
            tmp_path / "object.bin",
            expected_size=len(content),
            expected_checksum="0" * 64,
            max_bytes=1024,
        )
