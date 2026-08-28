import asyncio
import hashlib
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import boto3  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]

from narrativex_worker.config import WorkerSettings
from narrativex_worker.workspace import sha256_file


class MediaAssetConflictError(RuntimeError):
    pass


class MediaDownloadLimitError(MediaAssetConflictError):
    """The object exceeded an authorized download bound."""

    pass


@dataclass(frozen=True)
class StoredMediaAsset:
    storage_key: str
    checksum: str
    size_bytes: int
    mime_type: str
    metadata: dict[str, str] = field(default_factory=dict)


class MediaStorage(Protocol):
    async def put_immutable(
        self,
        *,
        storage_key: str,
        content: bytes,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset: ...

    async def find(self, storage_key: str) -> StoredMediaAsset | None: ...

    async def get_bytes(self, storage_key: str) -> bytes: ...

    async def download_to_file(
        self,
        storage_key: str,
        destination: Path,
        *,
        expected_size: int | None = None,
        expected_checksum: str | None = None,
        max_bytes: int | None = None,
    ) -> StoredMediaAsset: ...

    async def put_file_immutable(
        self,
        *,
        storage_key: str,
        file_path: Path,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset: ...


class InMemoryMediaStorage:
    """Test-only immutable storage implementation."""

    def __init__(self) -> None:
        self._objects: dict[str, tuple[StoredMediaAsset, bytes]] = {}

    async def put_immutable(
        self,
        *,
        storage_key: str,
        content: bytes,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        actual = hashlib.sha256(content).hexdigest()
        if actual != checksum:
            raise ValueError("content checksum does not match supplied checksum")
        existing = self._objects.get(storage_key)
        if existing is not None:
            asset, _ = existing
            if asset.checksum != checksum:
                raise MediaAssetConflictError(
                    f"storage key {storage_key} already contains different immutable content"
                )
            return asset
        asset = StoredMediaAsset(
            storage_key, checksum, len(content), mime_type, dict(metadata or {})
        )
        self._objects[storage_key] = (asset, content)
        return asset

    async def find(self, storage_key: str) -> StoredMediaAsset | None:
        value = self._objects.get(storage_key)
        return value[0] if value is not None else None

    async def get_bytes(self, storage_key: str) -> bytes:
        value = self._objects.get(storage_key)
        if value is None:
            raise FileNotFoundError(storage_key)
        return value[1]

    async def download_to_file(
        self,
        storage_key: str,
        destination: Path,
        *,
        expected_size: int | None = None,
        expected_checksum: str | None = None,
        max_bytes: int | None = None,
    ) -> StoredMediaAsset:
        asset = await self.find(storage_key)
        if asset is None:
            raise FileNotFoundError(storage_key)
        content = await self.get_bytes(storage_key)
        _validate_download_bounds(asset, expected_size, expected_checksum, max_bytes)
        destination.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(destination.write_bytes, content)
        return asset

    async def put_file_immutable(
        self,
        *,
        storage_key: str,
        file_path: Path,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        content = await asyncio.to_thread(file_path.read_bytes)
        return await self.put_immutable(
            storage_key=storage_key,
            content=content,
            checksum=checksum,
            mime_type=mime_type,
            metadata=metadata,
        )


class LocalMediaStorage:
    """Filesystem-backed immutable project-media store."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, storage_key: str) -> Path:
        path = (self.root / storage_key).resolve()
        if path == self.root or self.root not in path.parents:
            raise MediaAssetConflictError("local media key escapes the configured root")
        return path

    async def put_immutable(
        self,
        *,
        storage_key: str,
        content: bytes,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        actual = hashlib.sha256(content).hexdigest()
        if actual != checksum:
            raise ValueError("content checksum does not match supplied checksum")
        path = self._path(storage_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            existing = await self.find(storage_key)
            if existing is None or existing.checksum != checksum:
                raise MediaAssetConflictError("local media key already contains different content")
            return existing
        await asyncio.to_thread(path.write_bytes, content)
        return StoredMediaAsset(
            storage_key, checksum, len(content), mime_type, dict(metadata or {})
        )

    async def find(self, storage_key: str) -> StoredMediaAsset | None:
        path = self._path(storage_key)
        if not path.is_file():
            return None
        checksum = await asyncio.to_thread(sha256_file, path)
        return StoredMediaAsset(
            storage_key,
            checksum,
            path.stat().st_size,
            _mime_for_path(path),
            {},
        )

    async def get_bytes(self, storage_key: str) -> bytes:
        return await asyncio.to_thread(self._path(storage_key).read_bytes)

    async def download_to_file(
        self,
        storage_key: str,
        destination: Path,
        *,
        expected_size: int | None = None,
        expected_checksum: str | None = None,
        max_bytes: int | None = None,
    ) -> StoredMediaAsset:
        asset = await self.find(storage_key)
        if asset is None:
            raise FileNotFoundError(storage_key)
        _validate_download_bounds(asset, expected_size, expected_checksum, max_bytes)
        destination.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(destination.write_bytes, await self.get_bytes(storage_key))
        return asset

    async def put_file_immutable(
        self,
        *,
        storage_key: str,
        file_path: Path,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        content = await asyncio.to_thread(file_path.read_bytes)
        return await self.put_immutable(
            storage_key=storage_key,
            content=content,
            checksum=checksum,
            mime_type=mime_type,
            metadata=metadata,
        )


class S3MediaStorage:
    """Cloudflare R2 storage reserved for account-owned voice references."""

    logger = logging.getLogger("narrativex.worker.voice-reference.storage")

    def __init__(self, settings: WorkerSettings) -> None:
        settings.require_voice_reference_r2()
        endpoint = settings.resolved_r2_endpoint
        assert endpoint is not None
        assert settings.r2_access_key_id is not None
        assert settings.r2_secret_access_key is not None
        self.bucket = settings.r2_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name="auto",
            aws_access_key_id=settings.r2_access_key_id.get_secret_value(),
            aws_secret_access_key=settings.r2_secret_access_key.get_secret_value(),
        )

    async def put_immutable(
        self,
        *,
        storage_key: str,
        content: bytes,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        actual = hashlib.sha256(content).hexdigest()
        if actual != checksum:
            raise ValueError("content checksum does not match supplied checksum")
        object_metadata = dict(metadata or {})
        object_metadata["sha256"] = checksum
        try:
            await asyncio.to_thread(
                self.client.put_object,
                Bucket=self.bucket,
                Key=storage_key,
                Body=content,
                ContentType=mime_type,
                Metadata=object_metadata,
                IfNoneMatch="*",
            )
        except ClientError as exception:
            status = exception.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if status not in (409, 412):
                raise
            existing = await self.find(storage_key)
            if existing is None or existing.checksum != checksum:
                raise MediaAssetConflictError(
                    f"immutable storage conflict for {storage_key}"
                ) from exception
            return existing
        return StoredMediaAsset(storage_key, checksum, len(content), mime_type, object_metadata)

    async def find(self, storage_key: str) -> StoredMediaAsset | None:
        try:
            response = await asyncio.to_thread(
                self.client.head_object, Bucket=self.bucket, Key=storage_key
            )
        except ClientError as exception:
            status = exception.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if status == 404:
                return None
            raise
        metadata = {str(key): str(value) for key, value in response.get("Metadata", {}).items()}
        checksum = metadata.get("sha256")
        if not checksum:
            raise MediaAssetConflictError(f"stored object {storage_key} has no sha256 metadata")
        return StoredMediaAsset(
            storage_key,
            checksum,
            int(response["ContentLength"]),
            str(response.get("ContentType") or "application/octet-stream"),
            metadata,
        )

    async def get_bytes(self, storage_key: str) -> bytes:
        response = await asyncio.to_thread(
            self.client.get_object, Bucket=self.bucket, Key=storage_key
        )
        body = response["Body"]
        try:
            chunks: list[bytes] = []
            while chunk := await asyncio.to_thread(body.read, 1024 * 1024):
                chunks.append(bytes(chunk))
            return b"".join(chunks)
        finally:
            await asyncio.to_thread(body.close)

    async def download_to_file(
        self,
        storage_key: str,
        destination: Path,
        *,
        expected_size: int | None = None,
        expected_checksum: str | None = None,
        max_bytes: int | None = None,
    ) -> StoredMediaAsset:
        asset = await self.find(storage_key)
        if asset is None:
            raise FileNotFoundError(storage_key)
        _validate_download_bounds(asset, expected_size, expected_checksum, max_bytes)
        content = await self.get_bytes(storage_key)
        if len(content) != asset.size_bytes:
            raise OSError(f"downloaded object {storage_key} has unexpected size")
        actual = hashlib.sha256(content).hexdigest()
        if actual != asset.checksum.lower():
            raise MediaAssetConflictError(f"downloaded object {storage_key} checksum mismatch")
        destination.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(destination.write_bytes, content)
        return asset

    async def put_file_immutable(
        self,
        *,
        storage_key: str,
        file_path: Path,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        content = await asyncio.to_thread(file_path.read_bytes)
        return await self.put_immutable(
            storage_key=storage_key,
            content=content,
            checksum=checksum,
            mime_type=mime_type,
            metadata=metadata,
        )


def _validate_download_bounds(
    asset: StoredMediaAsset,
    expected_size: int | None,
    expected_checksum: str | None,
    max_bytes: int | None,
) -> None:
    if expected_size is not None and asset.size_bytes != expected_size:
        raise MediaAssetConflictError("object size does not match validation job")
    if max_bytes is not None and asset.size_bytes > max_bytes:
        raise MediaDownloadLimitError("object exceeds the authorized download limit")
    if expected_checksum is not None and asset.checksum.lower() != expected_checksum.lower():
        raise MediaAssetConflictError("object checksum does not match validation job")


def _mime_for_path(path: Path) -> str:
    return {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
    }.get(path.suffix.lower(), "application/octet-stream")
