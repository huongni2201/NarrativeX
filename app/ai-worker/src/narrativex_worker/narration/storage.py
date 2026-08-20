from dataclasses import dataclass
from typing import Protocol


class MediaAssetConflictError(RuntimeError):
    pass


@dataclass(frozen=True)
class StoredMediaAsset:
    storage_key: str
    checksum: str
    size_bytes: int
    mime_type: str


class MediaStorage(Protocol):
    async def put_immutable(
        self,
        *,
        storage_key: str,
        content: bytes,
        checksum: str,
        mime_type: str,
    ) -> StoredMediaAsset: ...

    async def find(self, storage_key: str) -> StoredMediaAsset | None: ...


class InMemoryMediaStorage:
    """Deterministic immutable storage fake mirroring the production storage contract."""

    def __init__(self) -> None:
        self._objects: dict[str, tuple[StoredMediaAsset, bytes]] = {}

    async def put_immutable(
        self,
        *,
        storage_key: str,
        content: bytes,
        checksum: str,
        mime_type: str,
    ) -> StoredMediaAsset:
        existing = self._objects.get(storage_key)
        if existing is not None:
            asset, _ = existing
            if asset.checksum != checksum:
                raise MediaAssetConflictError(
                    f"storage key {storage_key} already contains different immutable content"
                )
            return asset
        asset = StoredMediaAsset(
            storage_key=storage_key,
            checksum=checksum,
            size_bytes=len(content),
            mime_type=mime_type,
        )
        self._objects[storage_key] = (asset, content)
        return asset

    async def find(self, storage_key: str) -> StoredMediaAsset | None:
        value = self._objects.get(storage_key)
        return value[0] if value is not None else None
