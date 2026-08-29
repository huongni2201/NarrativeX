import inspect
from pathlib import Path

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.local_runner import LocalOptimizedNarrationWorkerRunner
from narrativex_worker.narration.repository.implementation import (
    NarrationWorkerRepository as NarrationWorkerRepositoryImplementation,
)
from narrativex_worker.providers.tts.vieneu import VieneuTtsProvider


class _EmptyVieneuClient:
    def list_preset_voices(self) -> list[tuple[str, str]]:
        return []


def test_vieneu_worker_can_boot_without_static_reference_for_r2_job_voice() -> None:
    settings = WorkerSettings(worker_env="test", tts_provider_mode="vieneu")

    provider = VieneuTtsProvider(settings, client=_EmptyVieneuClient())

    assert provider.voice_catalog_id == "vieneu-ngoc-huyen-v2"


def test_narration_claims_keep_scoped_custom_voices_and_system_voice_r2_fallback() -> None:
    source = inspect.getsource(NarrationWorkerRepositoryImplementation)

    assert source.count("LEFT JOIN voice_reference_assets avr") == 2
    assert source.count("LEFT JOIN media_assets pvr") == 2
    assert source.count("LEFT JOIN voice_catalog vc") == 2
    assert source.count("NULLIF(vc.metadata_json ->> 'referenceStorageKey', '')") == 2
    assert "account_voice_reference_asset_id" in source
    assert "project_voice_reference_asset_id" in source


def test_local_runner_accepts_system_r2_reference_without_custom_scope() -> None:
    source = inspect.getsource(LocalOptimizedNarrationWorkerRunner._prepare_reference)

    assert "voice_reference_storage_key is None" in source
    assert "voice_reference_scope is None" in source
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
