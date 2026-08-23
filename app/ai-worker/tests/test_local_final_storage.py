import hashlib
from pathlib import Path

import pytest

from narrativex_worker.rendering.local_final_storage import LocalFinalVideoStorage


@pytest.mark.asyncio
async def test_local_final_storage_is_immutable_and_reusable(tmp_path: Path) -> None:
    source = tmp_path / "chapter.mp4"
    content = b"realistic-test-mp4-bytes"
    source.write_bytes(content)
    checksum = hashlib.sha256(content).hexdigest()
    storage = LocalFinalVideoStorage(tmp_path / "final")

    first = await storage.put_immutable(
        file_path=source,
        render_fingerprint="a" * 64,
        checksum=checksum,
        generation_job_id=42,
    )
    second = await storage.put_immutable(
        file_path=source,
        render_fingerprint="a" * 64,
        checksum=checksum,
        generation_job_id=42,
    )

    assert first == second
    assert first.storage_provider == "LOCAL"
    assert first.external_file_id.endswith("a" * 64 + ".mp4")
