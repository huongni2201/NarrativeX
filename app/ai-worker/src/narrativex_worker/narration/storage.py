import asyncio
import hashlib
from dataclasses import dataclass, field
from typing import Protocol

import boto3  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]

from narrativex_worker.config import WorkerSettings


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
        body = await asyncio.to_thread(response["Body"].read)
        return bytes(body)
