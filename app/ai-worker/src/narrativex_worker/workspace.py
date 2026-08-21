import hashlib
import os
import re
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as content:
        while chunk := content.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def copy_file(source: Path, destination: Path, chunk_size: int = 1024 * 1024) -> int:
    total = 0
    with source.open("rb") as source_file, destination.open("wb") as destination_file:
        while chunk := source_file.read(chunk_size):
            destination_file.write(chunk)
            total += len(chunk)
    return total


class WorkerWorkspace:
    """Ephemeral per-job filesystem for media assembly and provider materialization."""

    def __init__(self, root: Path | None = None) -> None:
        configured_root = os.environ.get("NARRATIVEX_WORKSPACE_ROOT")
        self.root = root or Path(configured_root or (Path(tempfile.gettempdir()) / "narrativex"))

    @asynccontextmanager
    async def create_job_dir(self, job_key: str) -> AsyncIterator[Path]:
        safe_key = re.sub(r"[^A-Za-z0-9_-]+", "-", job_key).strip("-")[:80] or "job"
        self.root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=f"{safe_key}-", dir=self.root) as directory:
            yield Path(directory)
