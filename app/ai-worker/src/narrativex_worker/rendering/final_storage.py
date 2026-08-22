"""Durable storage boundary for final rendered videos."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

import httpx
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
_DRIVE_API = "https://www.googleapis.com/drive/v3"
_DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"
_CHUNK_SIZE = 8 * 1024 * 1024  # Must be a multiple of 256 KiB for Drive resumable uploads.


class FinalVideoStorageError(RuntimeError):
    """Raised when the durable final-video store cannot complete an operation."""


@dataclass(frozen=True)
class FinalVideoAsset:
    storage_provider: str
    storage_key: str
    external_file_id: str
    web_view_link: str | None
    size_bytes: int
    checksum: str
    mime_type: str


@dataclass(frozen=True)
class GoogleDriveSettings:
    client_id: str
    client_secret: str
    refresh_token: str
    folder_id: str
    timeout_seconds: float = 120.0

    @classmethod
    def from_env(cls) -> "GoogleDriveSettings":
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
            raise FinalVideoStorageError("GOOGLE_DRIVE_TIMEOUT_SECONDS must be numeric") from exception
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
        self._credentials = Credentials(
            token=None,
            refresh_token=settings.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.client_id,
            client_secret=settings.client_secret,
            scopes=[_DRIVE_SCOPE],
        )

    @classmethod
    def from_env(cls) -> "GoogleDriveFinalVideoStorage":
        return cls(GoogleDriveSettings.from_env())

    async def put_immutable(
        self,
        *,
        file_path: Path,
        render_fingerprint: str,
        checksum: str,
        generation_job_id: int,
    ) -> FinalVideoAsset:
        size_bytes = file_path.stat().st_size
        if size_bytes <= 0:
            raise FinalVideoStorageError("Rendered video is empty")

        token = await self._access_token()
        existing = await self._find_existing(token, render_fingerprint)
        if existing is not None:
            existing_size = int(existing.get("size") or 0)
            if existing_size != size_bytes:
                raise FinalVideoStorageError(
                    "Google Drive already contains the render fingerprint with a different size"
                )
            return self._to_asset(existing, checksum)

        name = f"{render_fingerprint}.mp4"
        metadata = {
            "name": name,
            "parents": [self.settings.folder_id],
            "appProperties": {
                "narrativexRenderFingerprint": render_fingerprint,
                "narrativexGenerationJobId": str(generation_job_id),
                "narrativexSha256": checksum,
            },
        }
        session_url = await self._start_resumable_upload(token, metadata, size_bytes)
        uploaded = await self._upload_chunks(token, session_url, file_path, size_bytes)
        file_id = str(uploaded.get("id") or "")
        if not file_id:
            raise FinalVideoStorageError("Google Drive upload completed without a file id")
        file_info = await self._get_file(token, file_id)
        return self._to_asset(file_info, checksum)

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
        return location

    async def _upload_chunks(
        self, token: str, session_url: str, file_path: Path, size_bytes: int
    ) -> dict[str, object]:
        offset = 0
        with file_path.open("rb") as source:
            async with httpx.AsyncClient(timeout=self.settings.timeout_seconds) as client:
                while offset < size_bytes:
                    source.seek(offset)
                    chunk = await asyncio.to_thread(source.read, min(_CHUNK_SIZE, size_bytes - offset))
                    if not chunk:
                        raise FinalVideoStorageError("Rendered video ended before expected size")
                    end = offset + len(chunk) - 1
                    headers = {
                        "Authorization": f"Bearer {token}",
                        "Content-Length": str(len(chunk)),
                        "Content-Range": f"bytes {offset}-{end}/{size_bytes}",
                    }
                    try:
                        response = await client.put(session_url, headers=headers, content=chunk)
                    except (httpx.TimeoutException, httpx.NetworkError):
                        offset = await self._query_resume_offset(client, token, session_url, size_bytes)
                        continue
                    if response.status_code == 308:
                        offset = self._next_offset(response, end + 1)
                        continue
                    self._raise_for_status(response, "upload final-video chunk")
                    payload = response.json()
                    if not isinstance(payload, dict):
                        raise FinalVideoStorageError("Google Drive returned an invalid upload response")
                    return payload
        raise FinalVideoStorageError("Google Drive resumable upload ended without completion")

    async def _query_resume_offset(
        self, client: httpx.AsyncClient, token: str, session_url: str, size_bytes: int
    ) -> int:
        response = await client.put(
            session_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Length": "0",
                "Content-Range": f"bytes */{size_bytes}",
            },
        )
        if response.status_code == 308:
            return self._next_offset(response, 0)
        if response.is_success:
            return size_bytes
        self._raise_for_status(response, "resume final-video upload")
        raise AssertionError("unreachable")

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
            raise FinalVideoStorageError("Could not refresh Google Drive OAuth token") from exception
        if not self._credentials.token:
            raise FinalVideoStorageError("Google Drive OAuth refresh returned an empty access token")
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
        size_bytes = int(file_info.get("size") or 0)
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
