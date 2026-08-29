"""Validate host-mounted runtime files before provider initialization."""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from pathlib import Path

from narrativex_worker.config import WorkerSettings


def validate_runtime_files(
    settings: WorkerSettings, *, environment: Mapping[str, str] | None = None
) -> None:
    """Fail fast when a configured bind mount resolves to a directory or invalid file.

    Google ADC may legitimately come from workload identity, so a credentials file is only
    validated when GOOGLE_APPLICATION_CREDENTIALS is explicitly configured. VieNeu reference
    audio is optional because narration jobs can materialize system/custom references from R2.
    """

    env = os.environ if environment is None else environment
    google_credentials = env.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    vertex_enabled = settings.provider_mode == "vertex" or settings.image_provider_mode == "vertex"
    if vertex_enabled and google_credentials:
        credentials_path = _require_regular_file(
            google_credentials, "GOOGLE_APPLICATION_CREDENTIALS"
        )
        try:
            parsed = json.loads(credentials_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeError(
                "GOOGLE_APPLICATION_CREDENTIALS must point to a readable JSON credentials file: "
                f"{credentials_path}"
            ) from exc
        if not isinstance(parsed, dict):
            raise RuntimeError(
                "GOOGLE_APPLICATION_CREDENTIALS must contain a JSON object: "
                f"{credentials_path}"
            )

    if settings.has_worker_role("narration") and settings.tts_provider_mode == "vieneu":
        reference_path = (settings.vieneu_reference_audio_path or "").strip()
        if reference_path:
            _require_regular_file(reference_path, "VIENEU_REFERENCE_AUDIO_PATH")


def _require_regular_file(raw_path: str, setting_name: str) -> Path:
    path = Path(raw_path)
    if not path.exists():
        raise RuntimeError(f"{setting_name} does not exist: {path}")
    if not path.is_file():
        raise RuntimeError(
            f"{setting_name} must point to a regular file, not a directory: {path}"
        )
    if path.stat().st_size <= 0:
        raise RuntimeError(f"{setting_name} must not point to an empty file: {path}")
    return path
