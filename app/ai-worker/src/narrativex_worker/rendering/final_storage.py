"""Durable storage boundary for final rendered videos."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from urllib.parse import quote
from uuid import UUID

import httpx
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
_DRIVE_API = "https://www.googleapis.com/drive/v3"
_DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"
_CHUNK_SIZE = 8 * 1024 * 1024  # Multiple of 256 KiB, as required by Drive.
logger = logging.getLogger("narrativex.worker.render.final-storage")


class FinalVideoStorageError(RuntimeError):
    """Raised when the durable final-video store cannot complete an operation."""


class FinalVideoStorage(Protocol):
    async def put_immutable(
        self,
        *,
        file_path: Path,
        render_fingerprint: str,
        checksum: str,
        generation_job_id: UUID,
    ) -> FinalVideoAsset: ...


@dataclass(frozen=True)
class FinalVideoAsset:
    storage_provider: str
    storage_key: str
    external_file_id: str
    web_view_link: str | None
    size_bytes: int
    checksum: str
    mime_type: str


@dataclass
class _UploadMetrics:
    uploaded_bytes: int = 0
    resume_count: int = 0
    drive_http_retries: int = 0


@dataclass(frozen=True)
class GoogleDriveSettings:
    client_id: str
    client_secret: str
    refresh_token: str
    folder_id: str
    timeout_seconds: float = 120.0

    @classmethod
    def from_env(cls) -> GoogleDriveSettings:
        required = {
            "GOOGLE_DRIVE_CLIENT_ID": os.getenv("GOOGLE_DRIVE_CLIENT_ID", "").strip(),
            "GOOGLE_DRIVE_CLIENT_SECRET": os.getenv("GOOGLE_DRIVE_CLIENT_SECRET", "").strip(),
            "GOOGLE_DRIVE_REFRESH_TOKEN": os.getenv("GOOGLE_DRIVE_REFRESH_TOKEN", "").strip(),
            "GOOGLE_DRIVE_FOLDER_ID": os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip(),
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise FinalVideoStorageError(
                "Missing Google Drive settings: " + ", ".join(sorted(missing))
            )
        timeout_raw = os.getenv("GOOGLE_DRIVE_TIMEOUT_SECONDS", "120").strip()
        try:
            timeout_seconds = float(timeout_raw)
        except ValueError as exception:
            raise FinalVideoStorageError(
                "GOOGLE_DRIVE_TIMEOUT_SECONDS must be numeric"
            ) from exception
        if timeout_seconds <= 0:
            raise FinalVideoStorageError("GOOGLE_DRIVE_TIMEOUT_SECONDS must be positive")
        return cls(
            client_id=required["GOOGLE_DRIVE_CLIENT_ID"],
            client_secret=required["GOOGLE_DRIVE_CLIENT_SECRET"],
            refresh_token=required["GOOGLE_DRIVE_REFRESH_TOKEN"],
            folder_id=required["GOOGLE_DRIVE_FOLDER_ID"],
            timeout_seconds=timeout_seconds,
        )


class GoogleDriveFinalVideoStorage:
    """Store immutable final MP4s in a user-owned Google Drive folder."""

    def __init__(self, settings: GoogleDriveSettings) -> None:
        self.settings = settings
        self._credentials = Credentials(  # type: ignore[no-untyped-call]
            token=None,
            refresh_token=settings.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.client_id,
            client_secret=settings.client_secret,
            scopes=[_DRIVE_SCOPE],
        )

    @classmethod
    def from_env(cls) -> GoogleDriveFinalVideoStorage:
        return cls(GoogleDriveSettings.from_env())

    async def put_immutable(
        self,
        *,
        file_path: Path,
        render_fingerprint: str,
        checksum: str,
        generation_job_id: UUID,
    ) -> FinalVideoAsset:
        started_at = time.perf_counter()
        metrics = _UploadMetrics()
        size_bytes = 0
        reused = False
        outcome = "failed"
        try:
            size_bytes = file_path.stat().st_size
            if size_bytes <= 0:
                raise FinalVideoStorageError("Rendered video is empty")

            token = await self._access_token()
            existing = await self._find_existing(token, render_fingerprint)
            if existing is not None:
                raw_size = existing.get("size")
                existing_size = (
                    int(raw_size) if isinstance(raw_size, (str, int, float)) else 0
                )
                properties = existing.get("appProperties") or {}
                existing_checksum = (
                    str(properties.get("narrativexSha256") or "")
                    if isinstance(properties, dict)
                    else ""
                )
                if existing_size != size_bytes or existing_checksum != checksum:
                    raise FinalVideoStorageError(
                        "Google Drive already contains the render fingerprint with "
                        "different immutable content"
                    )
                reused = True
                outcome = "reused"
                return self._to_asset(existing, existing_checksum)

            metadata: dict[str, object] = {
                "name": f"{render_fingerprint}.mp4",
                "parents": [self.settings.folder_id],
                "appProperties": {
                    "narrativexRenderFingerprint": render_fingerprint,
                    "narrativexGenerationJobId": str(generation_job_id),
                    "narrativexSha256": checksum,
                },
            }
            session_url = await self._start_resumable_upload(token, metadata, size_bytes)
            uploaded = await self._upload_chunks(
                token,
                session_url,
                file_path,
                size_bytes,
                metrics=metrics,
            )
            metrics.uploaded_bytes = size_bytes
            file_id = str(uploaded.get("id") or "")
            if not file_id:
                raise FinalVideoStorageError("Google Drive upload completed without a file id")
            file_info = await self._get_file(token, file_id)
            properties = file_info.get("appProperties") or {}
            uploaded_checksum = (
                str(properties.get("narrativexSha256") or "")
                if isinstance(properties, dict)
                else ""
            )
            if uploaded_checksum != checksum:
                raise FinalVideoStorageError(
                    "Google Drive uploaded file metadata does not match the local SHA-256"
                )
            outcome = "uploaded"
            return self._to_asset(file_info, uploaded_checksum)
        finally:
            logger.info(
                "final_video_upload outcome=%s generation_job_id=%s "
                "upload_duration_seconds=%.3f uploaded_bytes=%s resume_count=%s "
                "drive_http_retries=%s reused=%s",
                outcome,
                generation_job_id,
                time.perf_counter() - started_at,
                metrics.uploaded_bytes,
                metrics.resume_count,
                metrics.drive_http_retries,
                reused,
            )

    async def _find_existing(self, token: str, fingerprint: str) -> dict[str, object] | None:
        escaped_fingerprint = fingerprint.replace("'", "\\'")
        escaped_folder = self.settings.folder_id.replace("'", "\\'")
        query = (
            f"'{escaped_folder}' in parents and trashed = false and "
            "appProperties has { key='narrativexRenderFingerprint' and "
            f"value='{escaped_fingerprint}' }}"
        )
        params = {
            "q": query,
            "spaces": "drive",
            "fields": "files(id,name,size,webViewLink,appProperties)",
            "pageSize": "2",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
        }
        async with httpx.AsyncClient(timeout=self.settings.timeout_seconds) as client:
            response = await client.get(
                f"{_DRIVE_API}/files",
                headers=self._headers(token),
                params=params,
            )
        self._raise_for_status(response, "search existing final video")
        files = response.json().get("files", [])
        if not isinstance(files, list) or not files:
            return None
        if len(files) > 1:
            raise FinalVideoStorageError(
                "Multiple Google Drive files share the same render fingerprint"
            )
        value = files[0]
        return value if isinstance(value, dict) else None

    async def _start_resumable_upload(
        self, token: str, metadata: dict[str, object], size_bytes: int
    ) -> str:
        headers = self._headers(token)
        headers.update(
            {
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "video/mp4",
                "X-Upload-Content-Length": str(size_bytes),
            }
        )
        async with httpx.AsyncClient(timeout=self.settings.timeout_seconds) as client:
            response = await client.post(
                f"{_DRIVE_UPLOAD_API}/files",
                headers=headers,
                params={"uploadType": "resumable", "supportsAllDrives": "true"},
                json=metadata,
            )
        self._raise_for_status(response, "start resumable final-video upload")
        location = response.headers.get("Location")
        if not location:
            raise FinalVideoStorageError("Google Drive did not return a resumable upload URL")
        return str(location)

    async def _upload_chunks(
        self,
        token: str,
        session_url: str,
        file_path: Path,
        size_bytes: int,
        *,
        metrics: _UploadMetrics | None = None,
    ) -> dict[str, object]:
        upload_metrics = metrics or _UploadMetrics()
        offset = 0
        with file_path.open("rb") as source:
            async with httpx.AsyncClient(timeout=self.settings.timeout_seconds) as client:
                while offset < size_bytes:
                    source.seek(offset)
                    read_size = min(_CHUNK_SIZE, size_bytes - offset)
                    chunk = await asyncio.to_thread(source.read, read_size)
                    if not chunk:
                        raise FinalVideoStorageError("Rendered video ended before expected size")
                    end = offset + len(chunk) - 1
                    headers = {
                        "Authorization": f"Bearer {token}",
                        "Content-Length": str(len(chunk)),
                        "Content-Range": f"bytes {offset}-{end}/{size_bytes}",
                    }
                    try:
                        response = await client.put(
                            session_url,
                            headers=headers,
                            content=chunk,
                        )
                    except (httpx.TimeoutException, httpx.NetworkError):
                        upload_metrics.drive_http_retries += 1
                        upload_metrics.resume_count += 1
                        offset, completed = await self._query_resume_state(
                            client,
                            token,
                            session_url,
                            size_bytes,
                        )
                        upload_metrics.uploaded_bytes = max(upload_metrics.uploaded_bytes, offset)
                        if completed is not None:
                            upload_metrics.uploaded_bytes = size_bytes
                            return completed
                        continue
                    if response.status_code == 308:
                        offset = self._next_offset(response, end + 1)
                        upload_metrics.uploaded_bytes = max(upload_metrics.uploaded_bytes, offset)
                        continue
                    self._raise_for_status(response, "upload final-video chunk")
                    payload = response.json()
                    if not isinstance(payload, dict):
                        raise FinalVideoStorageError(
                            "Google Drive returned an invalid upload response"
                        )
                    upload_metrics.uploaded_bytes = size_bytes
                    return payload
        raise FinalVideoStorageError("Google Drive resumable upload ended without completion")

    async def _query_resume_state(
        self,
        client: httpx.AsyncClient,
        token: str,
        session_url: str,
        size_bytes: int,
    ) -> tuple[int, dict[str, object] | None]:
        try:
            response = await client.put(
                session_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Length": "0",
                    "Content-Range": f"bytes */{size_bytes}",
                },
            )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise FinalVideoStorageError(
                "Could not query Google Drive resumable-upload state"
            ) from exception
        if response.status_code == 308:
            return self._next_offset(response, 0), None
        self._raise_for_status(response, "resume final-video upload")
        payload = response.json()
        if not isinstance(payload, dict):
            raise FinalVideoStorageError("Google Drive returned invalid completed-upload metadata")
        return size_bytes, payload

    @staticmethod
    def _next_offset(response: httpx.Response, fallback: int) -> int:
        value = response.headers.get("Range")
        if not value or "-" not in value:
            return fallback
        try:
            return int(value.rsplit("-", 1)[1]) + 1
        except ValueError:
            return fallback

    async def _get_file(self, token: str, file_id: str) -> dict[str, object]:
        fields = "id,name,size,webViewLink,appProperties"
        async with httpx.AsyncClient(timeout=self.settings.timeout_seconds) as client:
            response = await client.get(
                f"{_DRIVE_API}/files/{quote(file_id, safe='')}",
                headers=self._headers(token),
                params={"fields": fields, "supportsAllDrives": "true"},
            )
        self._raise_for_status(response, "read uploaded final video")
        payload = response.json()
        if not isinstance(payload, dict):
            raise FinalVideoStorageError("Google Drive returned invalid file metadata")
        return payload

    async def _access_token(self) -> str:
        if self._credentials.valid and self._credentials.token:
            return str(self._credentials.token)
        try:
            await asyncio.to_thread(self._credentials.refresh, Request())
        except Exception as exception:
            raise FinalVideoStorageError(
                "Could not refresh Google Drive OAuth token"
            ) from exception
        if not self._credentials.token:
            raise FinalVideoStorageError(
                "Google Drive OAuth refresh returned an empty access token"
            )
        return str(self._credentials.token)

    @staticmethod
    def _headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    @staticmethod
    def _raise_for_status(response: httpx.Response, operation: str) -> None:
        if response.is_success or response.status_code == 308:
            return
        detail = response.text[:500]
        raise FinalVideoStorageError(
            f"Google Drive failed to {operation}: HTTP {response.status_code}: {detail}"
        )

    @staticmethod
    def _to_asset(file_info: dict[str, object], checksum: str) -> FinalVideoAsset:
        file_id = str(file_info.get("id") or "")
        if not file_id:
            raise FinalVideoStorageError("Google Drive file metadata is missing id")
        raw_size = file_info.get("size")
        size_bytes = int(raw_size) if isinstance(raw_size, (str, int, float)) else 0
        if size_bytes <= 0:
            raise FinalVideoStorageError("Google Drive file metadata is missing size")
        web_view_link = file_info.get("webViewLink")
        return FinalVideoAsset(
            storage_provider="GOOGLE_DRIVE",
            storage_key=f"gdrive:{file_id}",
            external_file_id=file_id,
            web_view_link=str(web_view_link) if web_view_link else None,
            size_bytes=size_bytes,
            checksum=checksum,
            mime_type="video/mp4",
        )
