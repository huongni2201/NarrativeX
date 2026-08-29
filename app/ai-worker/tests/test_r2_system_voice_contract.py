import inspect
from pathlib import Path

from narrativex_worker.config import WorkerSettings
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


def test_narration_claims_resolve_custom_or_system_voice_r2_key() -> None:
    source = inspect.getsource(NarrationWorkerRepositoryImplementation)

    assert source.count("LEFT JOIN voice_reference_assets vra") == 2
    assert source.count("LEFT JOIN voice_catalog vc") == 2
    assert source.count("NULLIF(vc.metadata_json ->> 'referenceStorageKey', '')") == 2
    assert "LEFT JOIN media_assets ma ON ma.id = nr.voice_reference_asset_id" not in source


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
