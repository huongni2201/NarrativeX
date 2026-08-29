import hashlib
import json
import uuid
from pathlib import Path

import pytest

from narrativex_worker.narration.voice_reference_resolver import (
    ProjectVoiceReferenceError,
    resolve_project_voice_reference,
)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _write_project_voice(
    root: Path,
    project_id: uuid.UUID,
    asset_id: uuid.UUID,
    data: bytes,
) -> Path:
    project = root / str(project_id)
    audio = project / "assets" / "audio"
    audio.mkdir(parents=True)
    source = audio / f"{asset_id}.wav"
    source.write_bytes(data)
    manifest = {
        "schemaVersion": 2,
        "projectId": str(project_id),
        "createdAt": "2026-08-29T00:00:00.000Z",
        "updatedAt": "2026-08-29T00:00:00.000Z",
        "assets": {
            str(asset_id): {
                "assetId": str(asset_id),
                "kind": "AUDIO",
                "relativePath": f"assets/audio/{asset_id}.wav",
                "sizeBytes": len(data),
                "checksumSha256": _sha256(data),
                "updatedAt": "2026-08-29T00:00:00.000Z",
            }
        },
        "artifacts": {},
    }
    (project / "project.manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return source


def test_resolves_verified_project_audio(tmp_path: Path) -> None:
    project_id = uuid.uuid4()
    asset_id = uuid.uuid4()
    data = b"project-voice"
    source = _write_project_voice(tmp_path, project_id, asset_id, data)

    resolved = resolve_project_voice_reference(
        projects_root=tmp_path,
        project_id=project_id,
        asset_id=asset_id,
        expected_size_bytes=len(data),
        expected_sha256=_sha256(data),
    )

    assert resolved == source.resolve()


def test_rejects_project_voice_checksum_mismatch(tmp_path: Path) -> None:
    project_id = uuid.uuid4()
    asset_id = uuid.uuid4()
    data = b"project-voice"
    _write_project_voice(tmp_path, project_id, asset_id, data)

    with pytest.raises(ProjectVoiceReferenceError, match="checksum"):
        resolve_project_voice_reference(
            projects_root=tmp_path,
            project_id=project_id,
            asset_id=asset_id,
            expected_size_bytes=len(data),
            expected_sha256="0" * 64,
        )


def test_rejects_manifest_path_escape(tmp_path: Path) -> None:
    project_id = uuid.uuid4()
    asset_id = uuid.uuid4()
    data = b"project-voice"
    _write_project_voice(tmp_path, project_id, asset_id, data)
    manifest_path = tmp_path / str(project_id) / "project.manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["assets"][str(asset_id)]["relativePath"] = "../../outside.wav"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "outside.wav").write_bytes(data)

    with pytest.raises(ProjectVoiceReferenceError, match="outside project storage"):
        resolve_project_voice_reference(
            projects_root=tmp_path,
            project_id=project_id,
            asset_id=asset_id,
            expected_size_bytes=len(data),
            expected_sha256=_sha256(data),
        )
