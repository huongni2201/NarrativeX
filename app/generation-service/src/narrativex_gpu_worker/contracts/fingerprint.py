"""Canonical fingerprinting for Compute Protocol requests."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from .task import ComputeTask


def request_fingerprint(task: ComputeTask) -> str:
    semantic_payload: dict[str, Any] = {
        "protocolVersion": task.protocol_version,
        "task": task.task.model_dump(by_alias=True, mode="json"),
        "model": task.model.model_dump(by_alias=True, mode="json"),
        "constraints": task.constraints.model_dump(by_alias=True, mode="json"),
        "inputs": task.inputs.model_dump(by_alias=True, mode="json"),
        "artifacts": {
            "inputs": [
                {
                    "artifactId": str(artifact.artifact_id),
                    "role": artifact.role,
                    "mediaType": artifact.media_type,
                    "sizeBytes": artifact.size_bytes,
                    "sha256": artifact.sha256,
                }
                for artifact in task.artifacts.inputs
            ],
            "outputs": [
                {
                    "artifactId": str(target.artifact_id),
                    "role": target.role,
                    "mediaType": target.media_type,
                }
                for target in task.artifacts.outputs
            ],
        },
    }
    canonical = json.dumps(
        semantic_payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()
