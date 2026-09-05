"""Canonical serialization and fingerprints for durable analysis subcalls."""

from __future__ import annotations

import hashlib
import json
import uuid
from decimal import Decimal
from typing import Any


def _canonical_value(value: Any) -> Any:
    if isinstance(value, float):
        raise TypeError("canonical fingerprints must not contain floating-point values")
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _canonical_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_canonical_value(item) for item in value]
    if value is None or isinstance(value, (str, int, bool)):
        return value
    raise TypeError(f"unsupported canonical fingerprint value: {type(value).__name__}")


def canonical_json(value: Any) -> str:
    return json.dumps(
        _canonical_value(value),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def analysis_step_fingerprint(
    *,
    tenant_scope: str,
    chapter_source_hash: str,
    step_kind: str,
    owned_source_range: dict[str, Any],
    input_canon_versions: list[str],
    continuity_inputs: dict[str, Any],
    model_config: dict[str, Any],
    prompt_version: str,
    schema_version: int,
) -> str:
    payload = {
        "tenantScope": tenant_scope,
        "chapterSourceHash": chapter_source_hash,
        "stepKind": step_kind,
        "ownedSourceRange": owned_source_range,
        "inputCanonVersions": input_canon_versions,
        "continuityInputs": continuity_inputs,
        "modelConfig": model_config,
        "promptVersion": prompt_version,
        "schemaVersion": schema_version,
    }
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def result_fingerprint(value: Any) -> tuple[str, str]:
    serialized = canonical_json(value)
    return serialized, hashlib.sha256(serialized.encode("utf-8")).hexdigest()
