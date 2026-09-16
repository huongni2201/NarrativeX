from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from conftest import task_payload
from narrativex_gpu_worker.contracts import (
    ArtifactReadAccess,
    ArtifactWriteAccess,
    ComputeTask,
    InputArtifactRef,
    OutputArtifactTarget,
    ProducedArtifact,
    request_fingerprint,
)


def test_contract_example_is_accepted() -> None:
    task = ComputeTask.model_validate(task_payload())
    assert task.task.type == "audio.synthesize"
    assert task.model.executor == "voicestudio"
    assert request_fingerprint(task) == task.request_fingerprint


def test_text_generation_contract_is_closed_and_fingerprinted() -> None:
    payload = {
        "protocolVersion": "1.0",
        "taskId": str(uuid4()),
        "attemptId": str(uuid4()),
        "idempotencyKey": "compute:text:1",
        "requestFingerprint": "0" * 64,
        "task": {"type": "text.generate", "schemaVersion": "1.0"},
        "model": {
            "executor": "qwen",
            "model": "Qwen/Qwen3-8B-AWQ",
            "revision": "default",
        },
        "constraints": {
            "deadline": "2026-09-20T12:00:00Z",
            "maxRuntimeSeconds": 900,
        },
        "inputs": {
            "prompt": "Extract characters and visual beats.",
            "responseFormat": "json_object",
        },
        "artifacts": {"inputs": [], "outputs": []},
    }
    task = ComputeTask.model_validate(payload)
    assert task.task.type == "text.generate"
    assert request_fingerprint(task) != "0" * 64

    payload["inputs"]["sourceText"] = "must stay in backend"
    with pytest.raises(ValidationError):
        ComputeTask.model_validate(payload)


def test_unknown_fields_are_rejected() -> None:
    payload = task_payload()
    payload["inputs"]["metadata"] = {}
    with pytest.raises(ValidationError):
        ComputeTask.model_validate(payload)


def test_task_type_must_match_closed_input_schema() -> None:
    payload = deepcopy(task_payload())
    payload["task"]["type"] = "image.generate"
    with pytest.raises(ValidationError, match="inputs do not match task.type"):
        ComputeTask.model_validate(payload)


def test_input_artifact_ref_requires_size_and_sha256() -> None:
    access = ArtifactReadAccess(
        method="GET",
        url="https://artifact.invalid/read",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        headers={},
    )
    # Valid
    artifact = InputArtifactRef(
        artifact_id=uuid4(),
        role="source-audio",
        media_type="audio/wav",
        size_bytes=100,
        sha256="a" * 64,
        access=access,
    )
    assert artifact.size_bytes == 100

    # Missing size_bytes or sha256
    with pytest.raises(ValidationError):
        InputArtifactRef.model_validate(
            {
                "artifactId": str(uuid4()),
                "role": "source-audio",
                "mediaType": "audio/wav",
                "access": access.model_dump(by_alias=True, mode="json"),
            }
        )


def test_output_artifact_target_does_not_require_size_or_sha256() -> None:
    access = ArtifactWriteAccess(
        method="PUT",
        url="https://artifact.invalid/write",
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        headers={},
    )
    target = OutputArtifactTarget(
        artifact_id=uuid4(),
        role="synthesized-audio",
        media_type="audio/wav",
        access=access,
    )
    assert target.role == "synthesized-audio"
    assert not hasattr(target, "size_bytes")
    assert not hasattr(target, "sha256")


def test_artifact_read_access_allows_only_get() -> None:
    with pytest.raises(ValidationError):
        ArtifactReadAccess.model_validate(
            {
                "method": "PUT",
                "url": "https://artifact.invalid/test",
                "expiresAt": "2026-09-15T12:00:00Z",
                "headers": {},
            }
        )


def test_artifact_write_access_allows_only_put() -> None:
    with pytest.raises(ValidationError):
        ArtifactWriteAccess.model_validate(
            {
                "method": "GET",
                "url": "https://artifact.invalid/test",
                "expiresAt": "2026-09-15T12:00:00Z",
                "headers": {},
            }
        )


def test_produced_artifact_requires_size_and_sha256() -> None:
    produced = ProducedArtifact(
        artifact_id=uuid4(),
        role="synthesized-audio",
        media_type="audio/wav",
        size_bytes=1024,
        sha256="c" * 64,
    )
    assert produced.size_bytes == 1024

    with pytest.raises(ValidationError):
        ProducedArtifact.model_validate(
            {
                "artifactId": str(uuid4()),
                "role": "synthesized-audio",
                "mediaType": "audio/wav",
            }
        )


def test_fingerprint_ignores_attempt_and_expiring_access_descriptor() -> None:
    original_payload = task_payload()
    original = ComputeTask.model_validate(original_payload)
    changed_payload = deepcopy(original_payload)
    changed_payload["attemptId"] = "0199b862-1025-78be-bd71-c6969b74ab99"
    changed = ComputeTask.model_validate(changed_payload)
    assert request_fingerprint(changed) == request_fingerprint(original)


def test_fingerprint_changes_with_semantic_input() -> None:
    original_payload = task_payload()
    changed_payload = deepcopy(original_payload)
    changed_payload["inputs"]["script"] = "Nội dung khác"
    assert (
        request_fingerprint(ComputeTask.model_validate(changed_payload))
        != original_payload["requestFingerprint"]
    )


def test_fingerprint_changes_with_deadline_and_runtime_constraints() -> None:
    original_payload = task_payload()
    original = ComputeTask.model_validate(original_payload)

    # Changed deadline
    changed_deadline = deepcopy(original_payload)
    changed_deadline["constraints"]["deadline"] = "2026-09-20T12:00:00Z"
    assert request_fingerprint(ComputeTask.model_validate(changed_deadline)) != request_fingerprint(
        original
    )

    # Changed maxRuntimeSeconds
    changed_runtime = deepcopy(original_payload)
    changed_runtime["constraints"]["maxRuntimeSeconds"] = 1200
    assert request_fingerprint(ComputeTask.model_validate(changed_runtime)) != request_fingerprint(
        original
    )


def test_fingerprint_changes_with_model() -> None:
    original_payload = task_payload()
    original = ComputeTask.model_validate(original_payload)
    changed = deepcopy(original_payload)
    changed["model"]["revision"] = "0.9.0"
    assert request_fingerprint(ComputeTask.model_validate(changed)) != request_fingerprint(original)
