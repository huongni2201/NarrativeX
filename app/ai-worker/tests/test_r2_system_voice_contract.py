import asyncio
import inspect
import uuid
from dataclasses import replace
from pathlib import Path

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.repository import ClaimedNarrationJob, NarrationWorkerRepository
from narrativex_worker.providers.tts.vieneu import VieneuTtsProvider


class _EmptyVieneuClient:
    def list_preset_voices(self) -> list[tuple[str, str]]:
        return []


class _CatalogPool:
    def __init__(self, storage_key: str) -> None:
        self.storage_key = storage_key
        self.calls: list[tuple[str, str]] = []

    async def fetchval(self, sql: str, voice_id: str) -> str:
        self.calls.append((sql, voice_id))
        return self.storage_key


def _claimed_job(**overrides: object) -> ClaimedNarrationJob:
    claimed = ClaimedNarrationJob(
        stage_attempt_id=uuid.uuid4(),
        generation_job_id=uuid.uuid4(),
        job_id="job-1",
        narration_request_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        chapter_id=uuid.uuid4(),
        chapter_row_version=1,
        source_hash="a" * 64,
        source_text="Xin chao",
        voice_id="vieneu-ngoc-huyen-v2",
        language="vi-VN",
        speaking_rate=1.0,
        request_fingerprint="b" * 64,
    )
    return replace(claimed, **overrides)


def test_vieneu_worker_can_boot_without_static_reference_for_r2_job_voice() -> None:
    settings = WorkerSettings(worker_env="test", tts_provider_mode="vieneu")

    provider = VieneuTtsProvider(settings, client=_EmptyVieneuClient())

    assert provider.voice_catalog_id == "vieneu-ngoc-huyen-v2"


def test_repository_attaches_system_r2_key_only_when_no_custom_reference() -> None:
    repository = NarrationWorkerRepository("postgresql://unused", 60)
    pool = _CatalogPool("narration/vieneu-previews/vieneu-ngoc-huyen-v2.wav")
    repository._pool = pool  # type: ignore[assignment]

    resolved = asyncio.run(repository._attach_system_voice_reference(_claimed_job()))

    assert resolved.voice_reference_scope is None
    assert resolved.voice_reference_storage_key == (
        "narration/vieneu-previews/vieneu-ngoc-huyen-v2.wav"
    )
    assert len(pool.calls) == 1
    sql, voice_id = pool.calls[0]
    assert "voice_catalog" in sql
    assert "referenceStorageKey" in sql
    assert voice_id == "vieneu-ngoc-huyen-v2"

    project_reference = _claimed_job(
        voice_reference_scope="PROJECT",
        voice_reference_asset_id=uuid.uuid4(),
        voice_reference_status="READY",
        voice_reference_size_bytes=123,
        voice_reference_checksum="c" * 64,
    )
    unchanged = asyncio.run(repository._attach_system_voice_reference(project_reference))

    assert unchanged is project_reference
    assert len(pool.calls) == 1


def test_scoped_runner_accepts_system_r2_reference_without_custom_scope() -> None:
    from narrativex_worker.narration.scoped_local_runner import ScopedLocalNarrationWorkerRunner

    source = inspect.getsource(ScopedLocalNarrationWorkerRunner._prepare_reference)

    assert "voice_reference_scope is not None" in source
    assert "voice_reference_storage_key is None" in source
    assert "_download_system_reference" in source


def test_default_system_voice_seed_points_to_existing_r2_preview_key() -> None:
    seed = (
        Path(__file__).parents[2]
        / "backend-service"
        / "src"
        / "main"
        / "resources"
        / "db"
        / "migration"
        / "V8__seed_catalog.sql"
    ).read_text(encoding="utf-8")

    ngoc_huyen_row = next(
        line for line in seed.splitlines() if "'vieneu-ngoc-huyen-v2'" in line
    )
    assert '"voiceSource":"SYSTEM_REFERENCE"' in ngoc_huyen_row
    assert (
        '"referenceStorageKey":"narration/vieneu-previews/vieneu-ngoc-huyen-v2.wav"'
        in ngoc_huyen_row
    )
