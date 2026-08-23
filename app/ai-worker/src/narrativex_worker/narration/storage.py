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
            metadata=dict(metadata or {}),
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

    async def put_file_immutable(
        self,
        *,
        storage_key: str,
        file_path: Path,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        actual = sha256_file(file_path)
        if actual != checksum:
            raise ValueError("file checksum does not match supplied checksum")
        content_buffer = bytearray()
        with file_path.open("rb") as source:
            while chunk := source.read(1024 * 1024):
                content_buffer.extend(chunk)
        content = bytes(content_buffer)
        return await self.put_immutable(
            storage_key=storage_key,
            content=content,
            checksum=checksum,
            mime_type=mime_type,
            metadata=metadata,
        )

    async def download_to_file(
        self,
        storage_key: str,
        destination: Path,
        *,
        expected_size: int | None = None,
        expected_checksum: str | None = None,
        max_bytes: int | None = None,
    ) -> StoredMediaAsset:
        value = self._objects.get(storage_key)
        if value is None:
            raise FileNotFoundError(storage_key)
        asset, content = value
        if expected_size is not None and asset.size_bytes != expected_size:
            raise MediaAssetConflictError("object size does not match validation job")
        if max_bytes is not None and asset.size_bytes > max_bytes:
            raise MediaDownloadLimitError("object exceeds the authorized download limit")
        destination.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        total = 0
        with destination.open("wb") as output:
            for offset in range(0, len(content), 1024 * 1024):
                chunk = content[offset : offset + 1024 * 1024]
                total += len(chunk)
                if max_bytes is not None and total > max_bytes:
                    raise MediaDownloadLimitError("object exceeds the authorized download limit")
                digest.update(chunk)
                output.write(chunk)
        if total != asset.size_bytes or (expected_size is not None and total != expected_size):
            raise OSError(f"downloaded object {storage_key} has unexpected size")
        checksum = digest.hexdigest()
        if checksum != asset.checksum.lower() or (
            expected_checksum is not None and checksum != expected_checksum.lower()
        ):
            raise MediaAssetConflictError(f"downloaded object {storage_key} checksum mismatch")
        return asset


class LocalMediaStorage:
    """Filesystem-backed immutable media store for deterministic local/E2E execution."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, storage_key: str) -> Path:
        path = (self.root / storage_key).resolve()
        if self.root not in path.parents:
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
        path = self._path(storage_key)
        actual = hashlib.sha256(content).hexdigest()
        if actual != checksum:
            raise ValueError("content checksum does not match supplied checksum")
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
        if expected_size is not None and asset.size_bytes != expected_size:
            raise MediaAssetConflictError("local media size mismatch")
        if max_bytes is not None and asset.size_bytes > max_bytes:
            raise MediaDownloadLimitError("object exceeds the authorized download limit")
        destination.parent.mkdir(parents=True, exist_ok=True)
        content = await self.get_bytes(storage_key)
        await asyncio.to_thread(destination.write_bytes, content)
        if expected_checksum is not None and asset.checksum != expected_checksum.lower():
            raise MediaAssetConflictError("local media checksum mismatch")
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


def _mime_for_path(path: Path) -> str:
    return {
        ".mp3": "audio/mpeg",
        ".png": "image/png",
        ".jpg": "image/jpeg",
    }.get(path.suffix.lower(), "application/octet-stream")


class S3MediaStorage:
    """Cloudflare R2 immutable media storage through its S3-compatible API."""

    logger = logging.getLogger("narrativex.worker.narration.storage")

    def __init__(self, settings: WorkerSettings) -> None:
        if settings.media_storage_mode != "r2":
            raise ValueError("S3MediaStorage is R2-only and requires MEDIA_STORAGE_MODE=r2")
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

    async def put_file_immutable(
        self,
        *,
        storage_key: str,
        file_path: Path,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        actual = await asyncio.to_thread(sha256_file, file_path)
        if actual != checksum:
            raise ValueError("file checksum does not match supplied checksum")
        object_metadata = dict(metadata or {})
        object_metadata["sha256"] = checksum
        size_bytes = file_path.stat().st_size
        self.logger.info(
            "R2 upload started storageKey=%s sizeBytes=%s checksum=%s",
            storage_key,
            size_bytes,
            checksum,
        )
        try:
            await asyncio.to_thread(
                self._put_file_sync,
                storage_key,
                file_path,
                mime_type,
                object_metadata,
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
            self.logger.info(
                "R2 upload reused existing immutable object storageKey=%s sizeBytes=%s checksum=%s",
                storage_key,
                existing.size_bytes,
                existing.checksum,
            )
            return existing
        except Exception:
            self.logger.exception(
                "R2 upload failed storageKey=%s sizeBytes=%s checksum=%s",
                storage_key,
                size_bytes,
                checksum,
            )
            raise
        self.logger.info(
            "R2 upload completed storageKey=%s sizeBytes=%s checksum=%s",
            storage_key,
            size_bytes,
            checksum,
        )
        return StoredMediaAsset(
            storage_key,
            checksum,
            size_bytes,
            mime_type,
            object_metadata,
        )

    def _put_file_sync(
        self,
        storage_key: str,
        file_path: Path,
        mime_type: str,
        metadata: dict[str, str],
    ) -> None:
        with file_path.open("rb") as content:
            self.client.put_object(
                Bucket=self.bucket,
                Key=storage_key,
                Body=content,
                ContentLength=file_path.stat().st_size,
                ContentType=mime_type,
                Metadata=metadata,
                IfNoneMatch="*",
            )

    async def download_to_file(
        self,
        storage_key: str,
        destination: Path,
        *,
        expected_size: int | None = None,
        expected_checksum: str | None = None,
        max_bytes: int | None = None,
    ) -> StoredMediaAsset:
        return await asyncio.to_thread(
            self._download_to_file_sync,
            storage_key,
            destination,
            expected_size,
            expected_checksum,
            max_bytes,
        )

    def _download_to_file_sync(
        self,
        storage_key: str,
        destination: Path,
        expected_size: int | None,
        expected_checksum: str | None,
        max_bytes: int | None,
    ) -> StoredMediaAsset:
        response = self.client.get_object(Bucket=self.bucket, Key=storage_key)
        body = response["Body"]
        metadata = {str(key): str(value) for key, value in response.get("Metadata", {}).items()}
        checksum = metadata.get("sha256")
        if not checksum:
            body.close()
            raise MediaAssetConflictError(f"stored object {storage_key} has no sha256 metadata")
        content_length = int(response.get("ContentLength", -1))
        if content_length < 0:
            body.close()
            raise MediaAssetConflictError("object has no valid content length")
        if expected_size is not None and content_length != expected_size:
            body.close()
            raise MediaAssetConflictError("object size does not match validation job")
        if max_bytes is not None and content_length > max_bytes:
            body.close()
            raise MediaDownloadLimitError("object exceeds the authorized download limit")
        destination.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        total = 0
        try:
            with destination.open("wb") as output:
                while chunk := body.read(1024 * 1024):
                    total += len(chunk)
                    if max_bytes is not None and total > max_bytes:
                        raise MediaDownloadLimitError(
                            "object exceeds the authorized download limit"
                        )
                    digest.update(chunk)
                    output.write(chunk)
        finally:
            body.close()
        asset = StoredMediaAsset(
            storage_key,
            checksum,
            content_length,
            str(response.get("ContentType") or "application/octet-stream"),
            metadata,
        )
        if total != asset.size_bytes or (expected_size is not None and total != expected_size):
            raise OSError(f"downloaded object {storage_key} has unexpected size")
        actual_checksum = digest.hexdigest()
        if actual_checksum != checksum.lower() or (
            expected_checksum is not None and actual_checksum != expected_checksum.lower()
        ):
            raise MediaAssetConflictError(f"downloaded object {storage_key} checksum mismatch")
        return asset
