"""Resolve project-owned voice references from immutable Desktop ProjectStorage manifests."""

from __future__ import annotations

import hashlib
import json
import uuid
from pathlib import Path
from typing import Any


class ProjectVoiceReferenceError(ValueError):
    """A PROJECT voice reference is missing, stale, unsafe, or corrupt."""


def resolve_project_voice_reference(
    *,
    projects_root: Path,
    project_id: uuid.UUID,
    asset_id: uuid.UUID,
    expected_size_bytes: int,
    expected_sha256: str,
) -> Path:
    root = projects_root.expanduser().resolve(strict=True)
    if not root.is_dir():
        raise ProjectVoiceReferenceError("PROJECT_MEDIA_LOCAL_DIR must be a directory")

    project_root = (root / str(project_id)).resolve(strict=True)
    if not project_root.is_dir() or not project_root.is_relative_to(root):
        raise ProjectVoiceReferenceError("Project voice reference is outside project storage")

    manifest_path = project_root / "project.manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exception:
        raise ProjectVoiceReferenceError("Project voice manifest is unavailable or invalid") from exception

    _validate_manifest_identity(manifest, project_id)
    assets = manifest.get("assets")
    if not isinstance(assets, dict):
        raise ProjectVoiceReferenceError("Project voice manifest assets are invalid")
    entry = assets.get(str(asset_id))
    if not isinstance(entry, dict):
        raise ProjectVoiceReferenceError("Project voice reference asset is missing from manifest")
    if entry.get("assetId") != str(asset_id) or entry.get("kind") != "AUDIO":
        raise ProjectVoiceReferenceError("Project voice reference is not a manifest AUDIO asset")

    relative_path = entry.get("relativePath")
    if not isinstance(relative_path, str) or not relative_path.strip():
        raise ProjectVoiceReferenceError("Project voice reference path is invalid")
    source_path = (project_root / relative_path).resolve(strict=True)
    if not source_path.is_file() or not source_path.is_relative_to(project_root):
        raise ProjectVoiceReferenceError("Project voice reference is outside project storage")

    manifest_size = entry.get("sizeBytes")
    manifest_checksum = entry.get("checksumSha256")
    if manifest_size != expected_size_bytes:
        raise ProjectVoiceReferenceError("Project voice reference size metadata is stale")
    if manifest_checksum != expected_sha256.lower():
        raise ProjectVoiceReferenceError("Project voice reference checksum metadata is stale")

    actual_size = source_path.stat().st_size
    if actual_size != expected_size_bytes:
        raise ProjectVoiceReferenceError("Project voice reference size does not match metadata")
    actual_checksum = _sha256_file(source_path)
    if actual_checksum != expected_sha256.lower():
        raise ProjectVoiceReferenceError("Project voice reference checksum does not match metadata")
    return source_path


def _validate_manifest_identity(manifest: Any, project_id: uuid.UUID) -> None:
    if not isinstance(manifest, dict):
        raise ProjectVoiceReferenceError("Project voice manifest is invalid")
    if manifest.get("schemaVersion") != 2:
        raise ProjectVoiceReferenceError("Project voice manifest schema is unsupported")
    if manifest.get("projectId") != str(project_id):
        raise ProjectVoiceReferenceError("Project voice manifest project id does not match")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
