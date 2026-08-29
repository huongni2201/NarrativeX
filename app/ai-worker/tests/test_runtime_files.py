from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from narrativex_worker.runtime_files import validate_runtime_files


@dataclass
class _Settings:
    provider_mode: str = "disabled"
    image_provider_mode: str = "disabled"
    tts_provider_mode: str = "disabled"
    vieneu_reference_audio_path: str | None = None
    roles: set[str] = field(default_factory=set)

    def has_worker_role(self, role: str) -> bool:
        return role in self.roles


def test_vertex_credentials_directory_fails_fast(tmp_path) -> None:
    credentials_directory = tmp_path / "gcp-service-account.json"
    credentials_directory.mkdir()
    settings = _Settings(provider_mode="vertex", roles={"analysis"})

    with pytest.raises(RuntimeError, match="regular file, not a directory"):
        validate_runtime_files(
            settings,  # type: ignore[arg-type]
            environment={"GOOGLE_APPLICATION_CREDENTIALS": str(credentials_directory)},
        )


def test_vertex_credentials_must_be_valid_json(tmp_path) -> None:
    credentials_file = tmp_path / "gcp-service-account.json"
    credentials_file.write_text("not-json", encoding="utf-8")
    settings = _Settings(image_provider_mode="vertex", roles={"image-generation"})

    with pytest.raises(RuntimeError, match="readable JSON credentials file"):
        validate_runtime_files(
            settings,  # type: ignore[arg-type]
            environment={"GOOGLE_APPLICATION_CREDENTIALS": str(credentials_file)},
        )


def test_vertex_allows_adc_without_explicit_credentials_file() -> None:
    settings = _Settings(provider_mode="vertex", roles={"analysis"})

    validate_runtime_files(settings, environment={})  # type: ignore[arg-type]


def test_vieneu_allows_r2_job_reference_without_static_local_file() -> None:
    settings = _Settings(tts_provider_mode="vieneu", roles={"narration"})

    validate_runtime_files(settings, environment={})  # type: ignore[arg-type]


def test_vieneu_reference_audio_must_be_regular_file_when_configured(tmp_path) -> None:
    reference_directory = tmp_path / "reference.wav"
    reference_directory.mkdir()
    settings = _Settings(
        tts_provider_mode="vieneu",
        vieneu_reference_audio_path=str(reference_directory),
        roles={"narration"},
    )

    with pytest.raises(RuntimeError, match="regular file, not a directory"):
        validate_runtime_files(settings, environment={})  # type: ignore[arg-type]


def test_configured_runtime_files_are_accepted(tmp_path) -> None:
    credentials_file = tmp_path / "gcp-service-account.json"
    credentials_file.write_text('{"type":"service_account"}', encoding="utf-8")
    reference_file = tmp_path / "reference.wav"
    reference_file.write_bytes(b"RIFF-test")
    settings = _Settings(
        provider_mode="vertex",
        tts_provider_mode="vieneu",
        vieneu_reference_audio_path=str(reference_file),
        roles={"analysis", "narration"},
    )

    validate_runtime_files(
        settings,  # type: ignore[arg-type]
        environment={"GOOGLE_APPLICATION_CREDENTIALS": str(credentials_file)},
    )
