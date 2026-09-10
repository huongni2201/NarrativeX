import asyncio
import hashlib
import json
import logging
import os
import tempfile
import time
from collections.abc import Iterator
from contextlib import contextmanager
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
        return await self.put_immutable(
            storage_key=storage_key,
            content=bytes(content_buffer),
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
    """Filesystem-backed immutable store for project working media."""

    _LOCK_RECORD_GRACE_SECONDS = 1.0

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, storage_key: str) -> Path:
        path = (self.root / storage_key).resolve()
        if self.root not in path.parents:
            raise MediaAssetConflictError("local media key escapes the configured root")
        return path

    @staticmethod
    def _marker(path: Path) -> Path:
        return path.with_name(path.name + ".nxmeta.json")

    @staticmethod
    def _lock(path: Path) -> Path:
        return path.with_name(path.name + ".nxlock")

    @staticmethod
    def _process_start_identity(pid: int) -> str | None:
        try:
            # Linux /proc field 22 is the process start time in clock ticks. Parse after the
            # parenthesized comm field so spaces in process names cannot shift the index.
            stat_text = Path(f"/proc/{pid}/stat").read_text(encoding="ascii")
            tail = stat_text.rsplit(")", 1)[1].split()
            return tail[19]
        except (FileNotFoundError, IndexError, OSError):
            return None

    @classmethod
    def _read_lock_owner(cls, lock_path: Path) -> tuple[int, str | None]:
        raw = lock_path.read_text(encoding="utf-8").strip()
        try:
            record = json.loads(raw)
            if not isinstance(record, dict):
                raise ValueError("invalid lock record")
            owner_start_raw = record.get("processStart")
            owner_start = None if owner_start_raw is None else str(owner_start_raw)
            return int(record["pid"]), owner_start
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            try:
                return int(raw), None
            except ValueError:
                try:
                    age = max(0.0, time.time() - lock_path.stat().st_mtime)
                except FileNotFoundError:
                    raise
                if age >= cls._LOCK_RECORD_GRACE_SECONDS:
                    raise ProcessLookupError("stale malformed lock") from None
                raise MediaAssetConflictError(
                    "local media object is locked by another writer"
                ) from None

    @contextmanager
    def _writer_lock(self, path: Path) -> Iterator[None]:
        lock_path = self._lock(path)
        while True:
            try:
                descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                record = {
                    "pid": os.getpid(),
                    "processStart": self._process_start_identity(os.getpid()),
                }
                with os.fdopen(descriptor, "w", encoding="utf-8") as lock:
                    json.dump(record, lock, separators=(",", ":"), sort_keys=True)
                    lock.flush()
                    os.fsync(lock.fileno())
                break
            except FileExistsError:
                try:
                    owner, owner_start = self._read_lock_owner(lock_path)
                    os.kill(owner, 0)
                    current_start = self._process_start_identity(owner)
                    if (
                        owner_start is not None
                        and current_start is not None
                        and owner_start != current_start
                    ):
                        try:
                            lock_path.unlink()
                        except FileNotFoundError:
                            pass
                        continue
                except ProcessLookupError:
                    try:
                        lock_path.unlink()
                    except FileNotFoundError:
                        pass
                    continue
                except MediaAssetConflictError:
                    raise
                except (OSError, ValueError):
                    # Permission errors do not prove that the owner is dead.
                    raise MediaAssetConflictError(
                        "local media object is locked by another writer"
                    ) from None
                raise MediaAssetConflictError(
                    "local media object is locked by another writer"
                ) from None
        try:
            yield
        finally:
            try:
                lock_path.unlink()
            except FileNotFoundError:
                pass

    @staticmethod
    def _write_commit(path: Path, content: bytes, record: dict[str, object]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        data_fd, data_name = tempfile.mkstemp(
            prefix=path.name + ".", suffix=".tmp", dir=path.parent
        )
        marker = LocalMediaStorage._marker(path)
        marker_fd, marker_name = tempfile.mkstemp(
            prefix=marker.name + ".", suffix=".tmp", dir=path.parent
        )
        try:
            with os.fdopen(data_fd, "wb") as staged:
                staged.write(content)
                staged.flush()
                os.fsync(staged.fileno())
            os.replace(data_name, path)
            with os.fdopen(marker_fd, "w", encoding="utf-8") as staged_marker:
                json.dump(record, staged_marker, separators=(",", ":"), sort_keys=True)
                staged_marker.flush()
                os.fsync(staged_marker.fileno())
            os.replace(marker_name, marker)
        finally:
            for temporary in (data_name, marker_name):
                try:
                    os.unlink(temporary)
                except FileNotFoundError:
                    pass

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
        record = {
            "schemaVersion": 1,
            "checksum": checksum,
            "sizeBytes": len(content),
            "mimeType": mime_type,
            "metadata": dict(metadata or {}),
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._writer_lock(path):
            existing = await self.find(storage_key)
            if existing is not None:
                if existing.checksum != checksum or existing.size_bytes != len(content):
                    raise MediaAssetConflictError(
                        "local media key already contains different content"
                    )
                if existing.mime_type != mime_type:
                    raise MediaAssetConflictError(
                        "local media key already has different immutable MIME metadata"
                    )
                return existing
            if path.exists():
                # The caller supplied durable checksum/size proof, so a byte-only
                # legacy/crash artifact may be adopted only when both match.
                if path.stat().st_size != len(content) or sha256_file(path) != checksum:
                    raise MediaAssetConflictError("incomplete local media bytes conflict")
                await asyncio.to_thread(
                    self._write_commit, path, await asyncio.to_thread(path.read_bytes), record
                )
            else:
                await asyncio.to_thread(self._write_commit, path, content, record)
        committed = await self.find(storage_key)
        if committed is None:
            raise MediaAssetConflictError("local media commit marker was not published")
        return committed

    async def find(self, storage_key: str) -> StoredMediaAsset | None:
        path = self._path(storage_key)
        marker = self._marker(path)
        if not path.is_file() or not marker.is_file():
            return None
        try:
            record = json.loads(await asyncio.to_thread(marker.read_text, encoding="utf-8"))
            if record.get("schemaVersion") != 1:
                raise ValueError("unsupported marker schema")
            checksum = str(record["checksum"]).lower()
            size = int(record["sizeBytes"])
            mime_type = str(record["mimeType"])
            metadata = record.get("metadata", {})
            if not isinstance(metadata, dict):
                raise ValueError("invalid metadata")
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exception:
            raise MediaAssetConflictError("local media completion marker is invalid") from exception
        if path.stat().st_size != size or await asyncio.to_thread(sha256_file, path) != checksum:
            raise MediaAssetConflictError("local media bytes do not match completion marker")
        return StoredMediaAsset(
            storage_key, checksum, size, mime_type, {str(k): str(v) for k, v in metadata.items()}
        )

    async def get_bytes(self, storage_key: str) -> bytes:
        asset = await self.find(storage_key)
        if asset is None:
            raise FileNotFoundError(storage_key)
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
        ".wav": "audio/wav",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
    }.get(path.suffix.lower(), "application/octet-stream")


class S3MediaStorage:
    """Cloudflare R2 immutable storage reserved for account-owned voice references."""

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
            "R2 voice-reference upload started storageKey=%s sizeBytes=%s checksum=%s",
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
            return existing
        return StoredMediaAsset(storage_key, checksum, size_bytes, mime_type, object_metadata)

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
