import hashlib

import pytest

from narrativex_worker.narration.storage import (
    LocalMediaStorage,
    MediaAssetConflictError,
)


@pytest.mark.asyncio
async def test_local_storage_persists_mime_and_metadata_across_restart(tmp_path) -> None:
    content = b"webp-provider-result"
    checksum = hashlib.sha256(content).hexdigest()
    key = f"private/provider-results/images/{checksum}"

    first = LocalMediaStorage(tmp_path)
    await first.put_immutable(
        storage_key=key,
        content=content,
        checksum=checksum,
        mime_type="image/webp",
        metadata={"kind": "provider-result"},
    )

    found = await LocalMediaStorage(tmp_path).find(key)
    assert found is not None
    assert found.mime_type == "image/webp"
    assert found.metadata == {"kind": "provider-result"}


@pytest.mark.asyncio
async def test_byte_only_object_is_not_visible_without_completion_marker(tmp_path) -> None:
    storage = LocalMediaStorage(tmp_path)
    path = storage._path("private/incomplete")
    path.parent.mkdir(parents=True)
    path.write_bytes(b"partial")

    assert await storage.find("private/incomplete") is None
    with pytest.raises(FileNotFoundError):
        await storage.get_bytes("private/incomplete")


@pytest.mark.asyncio
async def test_same_bytes_with_conflicting_mime_is_rejected(tmp_path) -> None:
    storage = LocalMediaStorage(tmp_path)
    content = b"image"
    checksum = hashlib.sha256(content).hexdigest()
    await storage.put_immutable(
        storage_key="private/image",
        content=content,
        checksum=checksum,
        mime_type="image/png",
    )

    with pytest.raises(MediaAssetConflictError, match="MIME"):
        await storage.put_immutable(
            storage_key="private/image",
            content=content,
            checksum=checksum,
            mime_type="image/jpeg",
        )


@pytest.mark.asyncio
async def test_corrupted_marker_is_not_treated_as_complete(tmp_path) -> None:
    storage = LocalMediaStorage(tmp_path)
    path = storage._path("private/image")
    path.parent.mkdir(parents=True)
    path.write_bytes(b"image")
    storage._marker(path).write_text("{broken", encoding="utf-8")

    with pytest.raises(MediaAssetConflictError, match="marker"):
        await storage.find("private/image")
