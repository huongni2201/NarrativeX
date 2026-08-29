import asyncio
import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

from narrativex_worker.narration.storage import S3MediaStorage


class _RecordingS3Client:
    def __init__(self) -> None:
        self.put_request: dict[str, Any] | None = None
        self.uploaded_content: bytes | None = None

    def put_object(self, **kwargs: Any) -> None:
        body = kwargs["Body"]
        self.uploaded_content = body.read()
        self.put_request = {key: value for key, value in kwargs.items() if key != "Body"}


class _FakeVieneu:
    def list_preset_voices(self) -> list[tuple[str, str]]:
        return [("preset-id", "Ngọc Huyền")]

    def infer(self, text: str, *, voice: str) -> bytes:
        assert text == "Xin chào, đây là giọng đọc thử của NarrativeX."
        assert voice == "Ngọc Huyền"
        return b"voice-preview"

    def save(self, audio: bytes, output_path: Path) -> None:
        output_path.write_bytes(audio)


def _load_preview_script() -> ModuleType:
    if "vieneu" not in sys.modules:
        vieneu_module = ModuleType("vieneu")
        vieneu_module.Vieneu = _FakeVieneu
        sys.modules["vieneu"] = vieneu_module

    script_path = Path(__file__).parents[1] / "scripts" / "generate_vieneu_previews.py"
    spec = importlib.util.spec_from_file_location("generate_vieneu_previews", script_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_publish_preview_adds_integrity_metadata_to_r2(tmp_path: Path) -> None:
    preview_path = tmp_path / "vieneu-ngoc-huyen-v2.wav"
    preview_path.write_bytes(b"voice-preview")
    client = _RecordingS3Client()
    storage = object.__new__(S3MediaStorage)
    storage.bucket = "voice-references"
    storage.client = client
    module = _load_preview_script()
    publish_preview = getattr(module, "publish_preview", None)

    assert publish_preview is not None, "preview generator must provide an R2 publish operation"
    published = asyncio.run(
        publish_preview(
            storage,
            preview_path,
            "narration/vieneu-previews/vieneu-ngoc-huyen-v2.wav",
        )
    )

    checksum = "673a354df5f01bcc927461cbf39fca6ef82c68428e24534803b771161ca7970a"
    assert published == {
        "sha256": checksum,
        "sizeBytes": 13,
    }
    assert client.put_request == {
        "Bucket": "voice-references",
        "Key": "narration/vieneu-previews/vieneu-ngoc-huyen-v2.wav",
        "ContentLength": 13,
        "ContentType": "audio/wav",
        "Metadata": {"sha256": checksum},
        "IfNoneMatch": "*",
    }
    assert client.uploaded_content == b"voice-preview"


def test_publish_flag_uploads_generated_preview_and_records_integrity(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load_preview_script()
    client = _RecordingS3Client()
    storage = object.__new__(S3MediaStorage)
    storage.bucket = "voice-references"
    storage.client = client
    monkeypatch.setattr(module, "VOICE_NAMES", {"vieneu-ngoc-huyen": "Ngọc Huyền"})
    monkeypatch.setattr(module, "Vieneu", lambda **kwargs: _FakeVieneu())
    monkeypatch.setattr(module, "get_settings", lambda: object(), raising=False)
    monkeypatch.setattr(module, "S3MediaStorage", lambda settings: storage)
    monkeypatch.setattr(
        "sys.argv",
        [
            "generate_vieneu_previews.py",
            "--output-dir",
            str(tmp_path),
            "--publish-r2",
        ],
    )

    module.main()

    checksum = "673a354df5f01bcc927461cbf39fca6ef82c68428e24534803b771161ca7970a"
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["files"] == [
        {
            "voiceId": "vieneu-ngoc-huyen",
            "voiceName": "Ngọc Huyền",
            "filename": "vieneu-ngoc-huyen.wav",
            "r2Key": "narration/vieneu-previews/vieneu-ngoc-huyen.wav",
            "sha256": checksum,
            "sizeBytes": 13,
        }
    ]
    assert client.put_request is not None
    assert client.put_request["Metadata"] == {"sha256": checksum}
