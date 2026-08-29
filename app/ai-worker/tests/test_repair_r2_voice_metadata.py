import hashlib
import importlib.util
from io import BytesIO
from pathlib import Path
from types import ModuleType
from typing import Any


class _Body(BytesIO):
    def close(self) -> None:
        super().close()


class _RecordingS3Client:
    def __init__(self, content: bytes) -> None:
        self.content = content
        self.metadata = {"owner": "catalog"}
        self.content_type = "audio/wav"
        self.copy_request: dict[str, Any] | None = None

    def get_object(self, **kwargs: Any) -> dict[str, Any]:
        assert kwargs == {"Bucket": "voice-references", "Key": "narration/vieneu-previews/test.wav"}
        return {
            "Body": _Body(self.content),
            "ContentLength": len(self.content),
            "ContentType": self.content_type,
            "Metadata": dict(self.metadata),
        }

    def copy_object(self, **kwargs: Any) -> dict[str, Any]:
        self.copy_request = kwargs
        self.metadata = dict(kwargs["Metadata"])
        self.content_type = kwargs["ContentType"]
        return {}

    def head_object(self, **kwargs: Any) -> dict[str, Any]:
        assert kwargs == {"Bucket": "voice-references", "Key": "narration/vieneu-previews/test.wav"}
        return {
            "ContentLength": len(self.content),
            "ContentType": self.content_type,
            "Metadata": dict(self.metadata),
        }


def _load_script() -> ModuleType:
    script_path = Path(__file__).parents[1] / "scripts" / "repair_r2_voice_metadata.py"
    spec = importlib.util.spec_from_file_location("repair_r2_voice_metadata", script_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_repair_object_adds_sha256_without_changing_voice_bytes() -> None:
    module = _load_script()
    content = b"legacy voice reference"
    client = _RecordingS3Client(content)

    result = module.repair_object_metadata(
        client,
        bucket="voice-references",
        storage_key="narration/vieneu-previews/test.wav",
    )

    checksum = hashlib.sha256(content).hexdigest()
    assert result == {
        "storageKey": "narration/vieneu-previews/test.wav",
        "sha256": checksum,
        "sizeBytes": len(content),
        "contentType": "audio/wav",
    }
    assert client.copy_request == {
        "Bucket": "voice-references",
        "Key": "narration/vieneu-previews/test.wav",
        "CopySource": {
            "Bucket": "voice-references",
            "Key": "narration/vieneu-previews/test.wav",
        },
        "MetadataDirective": "REPLACE",
        "Metadata": {"owner": "catalog", "sha256": checksum},
        "ContentType": "audio/wav",
    }


def test_repair_object_is_idempotent_when_sha256_is_already_correct() -> None:
    module = _load_script()
    content = b"already repaired voice"
    checksum = hashlib.sha256(content).hexdigest()
    client = _RecordingS3Client(content)
    client.metadata = {"sha256": checksum, "owner": "catalog"}

    result = module.repair_object_metadata(
        client,
        bucket="voice-references",
        storage_key="narration/vieneu-previews/test.wav",
    )

    assert result["sha256"] == checksum
    assert client.copy_request is None
