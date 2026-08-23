import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import pytest
from pydantic import SecretStr

from narrativex_worker.config import WorkerSettings
from narrativex_worker.rendering import worker as render_worker
from narrativex_worker.rendering.ffmpeg import FfmpegError
from narrativex_worker.rendering.final_storage import (
    FinalVideoAsset,
    FinalVideoStorageError,
)
from narrativex_worker.rendering.repository import (
    ClaimedRenderJob,
    RenderAudioAsset,
    RenderBeatAsset,
    RenderLeaseLostError,
)
from narrativex_worker.rendering.subtitles import SubtitleSource
from narrativex_worker.rendering.validation import RenderValidationError
from narrativex_worker.rendering.worker import (
    RenderWorkerRunner,
    _dimensions,
    _normalize_durations,
    _parse_operation_type,
)
from narrativex_worker.workspace import WorkerWorkspace


def _beat(duration_ms: int | None) -> RenderBeatAsset:
    return RenderBeatAsset(
        scene_index=0,
        beat_index=0,
        visual_beat_id=1,
        duration_ms=duration_ms,
        camera_movement="NONE",
        storage_key="image.png",
        size_bytes=10,
        checksum="a" * 64,
    )


def test_parse_render_operation_type() -> None:
    assert _parse_operation_type("CHAPTER_RENDER_1080P_MP4") == ("1080p", "mp4")
    assert _parse_operation_type("CHAPTER_RENDER_720P_MP4") == ("720p", "mp4")


def test_render_dimensions_follow_aspect_ratio() -> None:
    assert _dimensions("1080p", "16:9") == (1920, 1080)
    assert _dimensions("720p", "9:16") == (720, 1280)
    assert _dimensions("720p", "1:1") == (720, 720)


def test_duration_normalization_matches_audio_duration() -> None:
    durations = _normalize_durations([_beat(1000), _beat(2000), _beat(1000)], 8000)
    assert sum(durations) == 8000
    assert durations == [2000, 4000, 2000]


def test_duration_normalization_falls_back_when_plan_has_no_timing() -> None:
    durations = _normalize_durations([_beat(None), _beat(None), _beat(None)], 3001)
    assert sum(durations) == 3001
    assert all(value > 0 for value in durations)


def _settings() -> WorkerSettings:
    return WorkerSettings(
        worker_roles="render",
        media_storage_mode="r2",
        r2_endpoint="https://r2.example",
        r2_access_key_id=SecretStr("access-key"),
        r2_secret_access_key=SecretStr("secret-key"),
    )


def _claimed() -> ClaimedRenderJob:
    return ClaimedRenderJob(
        stage_attempt_id=11,
        generation_job_id=21,
        job_id="render-job-21",
        project_id=31,
        project_owner_id="owner-31",
        chapter_id=41,
        chapter_row_version=2,
        source_hash="a" * 64,
        media_plan_id=uuid4(),
        media_plan_revision=3,
        operation_type="CHAPTER_RENDER_720P_MP4",
        aspect_ratio="16:9",
        narration_request_id=None,
        narration_asset_id=None,
        narration_alignment_id=None,
        worker_id="render-test-worker",
        lease_token=uuid4(),
    )


class _FakeRepository:
    def __init__(self, *, lost_on_assert: int | None = None) -> None:
        self.lost_on_assert = lost_on_assert
        self.assert_count = 0
        self.completed: list[dict[str, Any]] = []
        self.stalled: list[str] = []
        self.failed: list[str] = []

    async def load_beats(self, claimed: ClaimedRenderJob) -> list[RenderBeatAsset]:
        del claimed
        return [_beat(1000)]

    async def load_audio(self, claimed: ClaimedRenderJob) -> RenderAudioAsset:
        del claimed
        return RenderAudioAsset(
            storage_key="audio.mp3",
            size_bytes=4,
            checksum="b" * 64,
            duration_ms=1000,
        )

    async def assert_lease(self, claimed: ClaimedRenderJob) -> None:
        del claimed
        self.assert_count += 1
        if self.assert_count == self.lost_on_assert:
            raise RenderLeaseLostError("lease was reclaimed")

    async def complete(self, claimed: ClaimedRenderJob, **kwargs: Any) -> None:
        del claimed
        self.completed.append(kwargs)

    async def mark_stalled(self, claimed: ClaimedRenderJob, error_code: str) -> bool:
        del claimed
        self.stalled.append(error_code)
        return True

    async def fail(self, claimed: ClaimedRenderJob, error_code: str) -> None:
        del claimed
        self.failed.append(error_code)


class _FakeMediaStorage:
    async def download_to_file(
        self,
        storage_key: str,
        destination: Path,
        **kwargs: Any,
    ) -> None:
        del storage_key, kwargs
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"input")


class _FakeFinalStorage:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.failure = failure
        self.calls: list[str] = []
        self.upload_count = 0
        self.files: dict[str, FinalVideoAsset] = {}

    async def put_immutable(self, **kwargs: Any) -> FinalVideoAsset:
        fingerprint = str(kwargs["render_fingerprint"])
        self.calls.append(fingerprint)
        if self.failure is not None:
            raise self.failure
        existing = self.files.get(fingerprint)
        if existing is not None:
            return existing
        self.upload_count += 1
        asset = FinalVideoAsset(
            storage_provider="GOOGLE_DRIVE",
            storage_key=f"gdrive:render-{self.upload_count}",
            external_file_id=f"render-{self.upload_count}",
            web_view_link="https://drive.example/render",
            size_bytes=8,
            checksum=str(kwargs["checksum"]),
            mime_type="video/mp4",
        )
        self.files[fingerprint] = asset
        return asset


def _install_render_doubles(monkeypatch: pytest.MonkeyPatch) -> None:
    async def load_subtitle_source(*args: Any, **kwargs: Any) -> SubtitleSource:
        del args, kwargs
        return SubtitleSource("NarrativeX test render", (), None)

    async def render_image_motion(manifest: Any, *, timeout_seconds: float) -> Path:
        del timeout_seconds
        manifest.output_path.write_bytes(b"rendered")
        return cast(Path, manifest.output_path)

    async def probe_mp4(path: Path) -> dict[str, object]:
        assert path.exists()
        return {
            "streams": [
                {"codec_type": "video", "width": 1280, "height": 720},
                {"codec_type": "audio"},
            ],
            "format": {"duration": "1.0"},
        }

    def validate_probe(*args: Any, **kwargs: Any) -> None:
        del args, kwargs

    @asynccontextmanager
    async def fingerprint_lock(*args: Any, **kwargs: Any) -> AsyncIterator[None]:
        del args, kwargs
        yield

    monkeypatch.setattr(render_worker, "load_subtitle_source", load_subtitle_source)
    monkeypatch.setattr(render_worker, "render_image_motion", render_image_motion)
    monkeypatch.setattr(render_worker, "probe_mp4", probe_mp4)
    monkeypatch.setattr(render_worker, "validate_probe", validate_probe)
    monkeypatch.setattr(render_worker, "render_fingerprint_lock", fingerprint_lock)


def _runner(
    tmp_path: Path,
    repository: _FakeRepository,
    final_storage: _FakeFinalStorage,
) -> RenderWorkerRunner:
    return RenderWorkerRunner(
        _settings(),
        asyncio.Semaphore(1),
        repository=repository,  # type: ignore[arg-type]
        storage=_FakeMediaStorage(),  # type: ignore[arg-type]
        final_storage=final_storage,  # type: ignore[arg-type]
        workspace=WorkerWorkspace(tmp_path),
    )


@pytest.mark.asyncio
async def test_render_worker_happy_path_completes_with_drive_artifact(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _install_render_doubles(monkeypatch)
    repository = _FakeRepository()
    final_storage = _FakeFinalStorage()

    await _runner(tmp_path, repository, final_storage)._process(_claimed())

    assert repository.failed == []
    assert repository.stalled == []
    assert len(repository.completed) == 1
    assert final_storage.upload_count == 1
    assert repository.completed[0]["media_asset"].external_file_id == "render-1"
    assert repository.completed[0]["render_fingerprint"] in final_storage.files


@pytest.mark.asyncio
async def test_lease_lost_before_ffmpeg_does_not_render_or_mutate_job(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _install_render_doubles(monkeypatch)
    repository = _FakeRepository(lost_on_assert=1)
    final_storage = _FakeFinalStorage()

    await _runner(tmp_path, repository, final_storage)._process(_claimed())

    assert repository.assert_count == 1
    assert final_storage.calls == []
    assert repository.completed == []
    assert repository.failed == []
    assert repository.stalled == []


@pytest.mark.asyncio
async def test_lease_lost_after_ffmpeg_does_not_upload_to_drive(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _install_render_doubles(monkeypatch)
    repository = _FakeRepository(lost_on_assert=3)
    final_storage = _FakeFinalStorage()

    await _runner(tmp_path, repository, final_storage)._process(_claimed())

    assert repository.assert_count == 3
    assert final_storage.calls == []
    assert repository.completed == []


@pytest.mark.asyncio
async def test_lease_lost_after_drive_upload_does_not_complete_job(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _install_render_doubles(monkeypatch)
    repository = _FakeRepository(lost_on_assert=4)
    final_storage = _FakeFinalStorage()

    await _runner(tmp_path, repository, final_storage)._process(_claimed())

    assert len(final_storage.calls) == 1
    assert repository.completed == []
    assert repository.failed == []
    assert repository.stalled == []


@pytest.mark.asyncio
async def test_drive_transient_failure_marks_job_stalled(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _install_render_doubles(monkeypatch)
    repository = _FakeRepository()
    final_storage = _FakeFinalStorage(failure=FinalVideoStorageError("temporary Drive error"))

    await _runner(tmp_path, repository, final_storage)._process(_claimed())

    assert repository.stalled == ["GOOGLE_DRIVE_UPLOAD_RETRY"]
    assert repository.failed == []
    assert repository.completed == []


@pytest.mark.asyncio
async def test_ffmpeg_failure_marks_job_failed(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _install_render_doubles(monkeypatch)

    async def fail_ffmpeg(manifest: Any, *, timeout_seconds: float) -> Path:
        del manifest, timeout_seconds
        raise FfmpegError("ffmpeg exited with code 1")

    monkeypatch.setattr(render_worker, "render_image_motion", fail_ffmpeg)
    repository = _FakeRepository()
    final_storage = _FakeFinalStorage()

    await _runner(tmp_path, repository, final_storage)._process(_claimed())

    assert repository.failed == ["RENDER_INPUT_OR_FFMPEG_FAILED"]
    assert repository.stalled == []
    assert final_storage.calls == []


@pytest.mark.asyncio
async def test_validation_failure_marks_job_failed(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _install_render_doubles(monkeypatch)

    def fail_validation(*args: Any, **kwargs: Any) -> None:
        del args, kwargs
        raise RenderValidationError("invalid dimensions")

    monkeypatch.setattr(render_worker, "validate_probe", fail_validation)
    repository = _FakeRepository()
    final_storage = _FakeFinalStorage()

    await _runner(tmp_path, repository, final_storage)._process(_claimed())

    assert repository.failed == ["RENDER_INPUT_OR_FFMPEG_FAILED"]
    assert final_storage.calls == []


@pytest.mark.asyncio
async def test_same_fingerprint_retry_reuses_one_drive_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _install_render_doubles(monkeypatch)
    repository = _FakeRepository()
    final_storage = _FakeFinalStorage()
    runner = _runner(tmp_path, repository, final_storage)
    claimed = _claimed()

    await runner._process(claimed)
    await runner._process(claimed)

    assert len(final_storage.calls) == 2
    assert final_storage.upload_count == 1
    assert len(final_storage.files) == 1
    assert len({item["render_fingerprint"] for item in repository.completed}) == 1
