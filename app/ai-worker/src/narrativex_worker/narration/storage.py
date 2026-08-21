import asyncio
import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import boto3  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]

from narrativex_worker.config import WorkerSettings
from narrativex_worker.workspace import sha256_file


class MediaAssetConflictError(RuntimeError):
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
        self, storage_key: str, destination: Path
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
        self, storage_key: str, destination: Path
    ) -> StoredMediaAsset:
        value = self._objects.get(storage_key)
        if value is None:
            raise FileNotFoundError(storage_key)
        asset, content = value
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as output:
            for offset in range(0, len(content), 1024 * 1024):
                output.write(content[offset : offset + 1024 * 1024])
        if destination.stat().st_size != asset.size_bytes:
            raise OSError(f"downloaded object {storage_key} has unexpected size")
        if sha256_file(destination) != asset.checksum:
            raise MediaAssetConflictError(f"downloaded object {storage_key} checksum mismatch")
        return asset


class S3MediaStorage:
    """Cloudflare R2 immutable media storage through its S3-compatible API."""

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
            return existing
        return StoredMediaAsset(
            storage_key,
            checksum,
            file_path.stat().st_size,
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
        self, storage_key: str, destination: Path
    ) -> StoredMediaAsset:
        return await asyncio.to_thread(self._download_to_file_sync, storage_key, destination)

    def _download_to_file_sync(self, storage_key: str, destination: Path) -> StoredMediaAsset:
        response = self.client.get_object(Bucket=self.bucket, Key=storage_key)
        body = response["Body"]
        metadata = {str(key): str(value) for key, value in response.get("Metadata", {}).items()}
        checksum = metadata.get("sha256")
        if not checksum:
            body.close()
            raise MediaAssetConflictError(f"stored object {storage_key} has no sha256 metadata")
        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            with destination.open("wb") as output:
                while chunk := body.read(1024 * 1024):
                    output.write(chunk)
        finally:
            body.close()
        asset = StoredMediaAsset(
            storage_key,
            checksum,
            int(response["ContentLength"]),
            str(response.get("ContentType") or "application/octet-stream"),
            metadata,
        )
        if destination.stat().st_size != asset.size_bytes:
            raise OSError(f"downloaded object {storage_key} has unexpected size")
        if sha256_file(destination) != checksum:
            raise MediaAssetConflictError(f"downloaded object {storage_key} checksum mismatch")
        return asset
