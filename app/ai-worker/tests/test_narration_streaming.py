import asyncio
import hashlib
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.audio import FfmpegAudioAssembler
from narrativex_worker.narration.models import MaterializedAudioSegment, NarrationSegment
from narrativex_worker.narration.repository import ClaimedNarrationJob
from narrativex_worker.narration.runner import NarrationWorkerRunner
from narrativex_worker.narration.storage import (
    InMemoryMediaStorage,
    MediaAssetConflictError,
    S3MediaStorage,
    StoredMediaAsset,
)
from narrativex_worker.workspace import WorkerWorkspace


@pytest.mark.asyncio
async def test_media_storage_file_boundary_round_trips_without_bytes_api() -> None:
    content = b"pcm" * 4096
    checksum = hashlib.sha256(content).hexdigest()
    storage = InMemoryMediaStorage()

    import tempfile

    with tempfile.TemporaryDirectory() as directory:
        source_path = Path(directory) / "segment.pcm"
        destination_path = Path(directory) / "recovered.pcm"
        source_path.write_bytes(content)

        stored = await storage.put_file_immutable(
            storage_key="narration/request/segments/0000.pcm",
            file_path=source_path,
            checksum=checksum,
            mime_type="audio/L16",
        )
        recovered = await storage.download_to_file(stored.storage_key, destination_path)

        assert recovered == stored
        assert destination_path.read_bytes() == content

        different_path = Path(directory) / "different.pcm"
        different_path.write_bytes(b"different")
        with pytest.raises(MediaAssetConflictError):
            await storage.put_file_immutable(
                storage_key=stored.storage_key,
                file_path=different_path,
                checksum=hashlib.sha256(b"different").hexdigest(),
                mime_type="audio/L16",
            )


@pytest.mark.asyncio
async def test_worker_workspace_cleans_scratch_files_when_cancelled(tmp_path: Path) -> None:
    workspace = WorkerWorkspace(root=tmp_path)
    entered = asyncio.Event()

    async def run_job() -> None:
        async with workspace.create_job_dir("request-id") as job_dir:
            (job_dir / "chapter.pcm").write_bytes(b"scratch")
            entered.set()
            await asyncio.Event().wait()

    task = asyncio.create_task(run_job())
    await entered.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert list(tmp_path.iterdir()) == []


class _FileOnlyStorage(InMemoryMediaStorage):
    def __init__(self) -> None:
        super().__init__()
        self.file_uploads: list[Path] = []

    async def put_immutable(
        self,
        *,
        storage_key: str,
        content: bytes,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        del storage_key, content, checksum, mime_type, metadata
        raise AssertionError("production narration must not upload chapter bytes")

    async def put_file_immutable(
        self,
        *,
        storage_key: str,
        file_path: Path,
        checksum: str,
        mime_type: str,
        metadata: dict[str, str] | None = None,
    ) -> StoredMediaAsset:
        self.file_uploads.append(file_path)
        content = file_path.read_bytes()
        return await InMemoryMediaStorage.put_immutable(
            self,
            storage_key=storage_key,
            content=content,
            checksum=checksum,
            mime_type=mime_type,
            metadata=metadata,
        )


class _FileAudio:
    async def concatenate_files(self, input_paths: list[Path], output_path: Path) -> None:
        with output_path.open("wb") as output:
            for input_path in input_paths:
                output.write(input_path.read_bytes())

    async def encode_mp3_file(
        self,
        input_path: Path,
        output_path: Path,
        *,
        sample_rate_hz: int,
        channels: int,
    ) -> None:
        del sample_rate_hz, channels
        output_path.write_bytes(b"encoded-mp3:" + input_path.read_bytes())

    async def probe_duration_ms_file(self, path: Path) -> int:
        assert path.is_file()
        return 100


class _CompleteRepository:
    def __init__(self) -> None:
        self.completed = False

    async def complete(self, *args: object, **kwargs: object) -> None:
        del args, kwargs
        self.completed = True


def _claimed_job() -> ClaimedNarrationJob:
    return ClaimedNarrationJob(
        stage_attempt_id=1,
        generation_job_id=2,
        job_id="job-1",
        narration_request_id=uuid.uuid4(),
        project_id=3,
        chapter_id=4,
        chapter_row_version=1,
        source_hash="a" * 64,
        source_text="A chapter.",
        voice_id="Standard-voice",
        language="en-US",
        speaking_rate=1.0,
        request_fingerprint="request-1",
    )


@pytest.mark.asyncio
async def test_runner_uses_file_pipeline_and_cleans_workspace(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runner = NarrationWorkerRunner(WorkerSettings(worker_env="test"))
    runner.provider = object()  # type: ignore[assignment]
    runner.storage = _FileOnlyStorage()
    runner.audio = _FileAudio()  # type: ignore[assignment]
    runner.repository = _CompleteRepository()  # type: ignore[assignment]
    runner.workspace = WorkerWorkspace(root=tmp_path)

    async def materialize(
        claimed: ClaimedNarrationJob,
        current_segment: NarrationSegment,
        job_dir: Path,
    ) -> MaterializedAudioSegment:
        del claimed
        path = job_dir / "segment-0000.pcm"
        path.write_bytes(b"pcm")
        return MaterializedAudioSegment(current_segment, path, 48000, 1, 100, "a" * 64)

    monkeypatch.setattr(runner, "_materialize_segment", materialize)
    await runner._execute(_claimed_job())

    assert len(runner.storage.file_uploads) == 1
    assert runner.repository.completed  # type: ignore[attr-defined]
    assert list(tmp_path.iterdir()) == []


class _ChunkedBody:
    def __init__(self, content: bytes) -> None:
        self.content = content
        self.offset = 0
        self.read_sizes: list[int] = []
        self.closed = False

    def read(self, size: int) -> bytes:
        self.read_sizes.append(size)
        chunk = self.content[self.offset : self.offset + size]
        self.offset += len(chunk)
        return chunk

    def close(self) -> None:
        self.closed = True


class _FileStreamingS3Client:
    def __init__(self, content: bytes, checksum: str) -> None:
        self.body = _ChunkedBody(content)
        self.content = content
        self.checksum = checksum
        self.upload_body_was_file = False

    def get_object(self, **kwargs: object) -> dict[str, object]:
        del kwargs
        return {
            "Body": self.body,
            "ContentLength": len(self.content),
            "ContentType": "audio/L16",
            "Metadata": {"sha256": self.checksum},
        }

    def put_object(self, **kwargs: object) -> None:
        body = kwargs["Body"]
        self.upload_body_was_file = hasattr(body, "read") and not isinstance(body, bytes)


@pytest.mark.asyncio
async def test_r2_adapter_uses_chunked_file_download_and_file_upload(tmp_path: Path) -> None:
    content = b"r2-pcm" * 4096
    checksum = hashlib.sha256(content).hexdigest()
    client = _FileStreamingS3Client(content, checksum)
    storage = object.__new__(S3MediaStorage)
    storage.bucket = "test-bucket"
    storage.client = client
    source_path = tmp_path / "source.pcm"
    source_path.write_bytes(content)

    uploaded = await storage.put_file_immutable(
        storage_key="segments/0000.pcm",
        file_path=source_path,
        checksum=checksum,
        mime_type="audio/L16",
    )
    recovered = await storage.download_to_file("segments/0000.pcm", tmp_path / "recovered.pcm")

    assert uploaded.size_bytes == len(content)
    assert recovered.checksum == checksum
    assert client.upload_body_was_file
    assert client.body.read_sizes
    assert all(size == 1024 * 1024 for size in client.body.read_sizes)
    assert client.body.closed


def test_file_duration_probe_does_not_delete_workspace_output(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    output_path = tmp_path / "chapter.mp3"
    output_path.write_bytes(b"mp3")

    monkeypatch.setattr(
        "narrativex_worker.narration.audio.subprocess.run",
        lambda *args, **kwargs: SimpleNamespace(stdout="1.0"),
    )

    assert FfmpegAudioAssembler._probe_duration_ms_sync(output_path) == 1000
    assert output_path.is_file()
