"""Filesystem-backed immutable final-video storage for deterministic E2E."""

from __future__ import annotations

import asyncio
from pathlib import Path
from uuid import UUID

from narrativex_worker.rendering.final_storage import FinalVideoAsset, FinalVideoStorageError
from narrativex_worker.workspace import sha256_file


class LocalFinalVideoStorage:
    """Immutable local final-video storage; production defaults to Google Drive."""

    def __init__(self, root: str | Path = "/tmp/narrativex-e2e/final") -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    async def put_immutable(
        self,
        *,
        file_path: Path,
        render_fingerprint: str,
        checksum: str,
        generation_job_id: UUID,
    ) -> FinalVideoAsset:
        del generation_job_id
        size_bytes = file_path.stat().st_size
        if size_bytes <= 0:
            raise FinalVideoStorageError("Rendered video is empty")
        destination = (self.root / f"{render_fingerprint}.mp4").resolve()
        if self.root not in destination.parents:
            raise FinalVideoStorageError("Invalid local final-video fingerprint")
        if destination.exists():
            existing_checksum = await asyncio.to_thread(sha256_file, destination)
            if existing_checksum != checksum or destination.stat().st_size != size_bytes:
                raise FinalVideoStorageError("Local final video conflicts with immutable content")
        else:
            temporary = destination.with_suffix(".tmp")
            content = await asyncio.to_thread(file_path.read_bytes)
            await asyncio.to_thread(temporary.write_bytes, content)
            await asyncio.to_thread(temporary.replace, destination)
        return FinalVideoAsset(
            storage_provider="LOCAL",
            storage_key=f"local-final:{destination.name}",
            external_file_id=str(destination),
            web_view_link=None,
            size_bytes=size_bytes,
            checksum=checksum,
            mime_type="video/mp4",
        )
