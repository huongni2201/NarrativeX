"""Validate NarrativeX Compute Protocol contracts without third-party dependencies."""

from __future__ import annotations

import hashlib
import json
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_ROOT = ROOT / "contracts" / "compute" / "v1"
SCHEMA_ROOT = CONTRACT_ROOT / "schemas"
EXAMPLE_ROOT = CONTRACT_ROOT / "examples"

TASK_SCHEMAS = {
    "audio.synthesize": "task-audio-synthesize.json",
    "audio.align": "task-audio-align.json",
    "image.generate": "task-image-generate.json",
    "media.validate": "task-media-validate.json",
    "text.generate": "task-text-generate.json",
}
FORBIDDEN_KEYS = {
    "projectId",
    "chapterId",
    "sceneId",
    "visualBeatId",
    "userId",
    "workspaceId",
    "generationJobId",
    "stageAttemptId",
    "providerOperationId",
    "path",
    "databaseUrl",
    "metadata",
}
WINDOWS_PATH = re.compile(r"^(?:[A-Za-z]:[\\/]|\\\\)")


class ContractError(ValueError):
    pass


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _matches_type(instance: Any, expected: str) -> bool:
    return {
        "object": isinstance(instance, dict),
        "array": isinstance(instance, list),
        "string": isinstance(instance, str),
        "integer": isinstance(instance, int) and not isinstance(instance, bool),
        "number": isinstance(instance, (int, float)) and not isinstance(instance, bool),
        "boolean": isinstance(instance, bool),
        "null": instance is None,
    }[expected]


def _resolve_ref(ref: str) -> dict[str, Any]:
    if ref.startswith("#"):
        raise ContractError(
            f"local JSON pointer is unsupported by the standalone validator: {ref}"
        )
    target = (SCHEMA_ROOT / ref).resolve()
    if target.parent != SCHEMA_ROOT.resolve():
        raise ContractError(f"schema reference escapes contract root: {ref}")
    return load_json(target)


def validate(instance: Any, schema: dict[str, Any], location: str = "$") -> None:
    if "$ref" in schema:
        validate(instance, _resolve_ref(schema["$ref"]), location)
        return

    if "oneOf" in schema:
        successes = 0
        for candidate in schema["oneOf"]:
            try:
                validate(instance, candidate, location)
                successes += 1
            except ContractError:
                pass
        if successes != 1:
            raise ContractError(
                f"{location}: expected exactly one matching schema, got {successes}"
            )

    expected = schema.get("type")
    if expected is not None:
        accepted = expected if isinstance(expected, list) else [expected]
        if not any(_matches_type(instance, item) for item in accepted):
            raise ContractError(
                f"{location}: expected type {accepted}, got {type(instance).__name__}"
            )

    if "const" in schema and instance != schema["const"]:
        raise ContractError(f"{location}: expected constant {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        raise ContractError(f"{location}: value is not in enum")

    if isinstance(instance, dict):
        properties = schema.get("properties", {})
        missing = [key for key in schema.get("required", []) if key not in instance]
        if missing:
            raise ContractError(f"{location}: missing required properties {missing}")
        additional = schema.get("additionalProperties", True)
        for key, value in instance.items():
            if key in properties:
                validate(value, properties[key], f"{location}.{key}")
            elif additional is False:
                raise ContractError(
                    f"{location}: additional property {key!r} is forbidden"
                )
            elif isinstance(additional, dict):
                validate(value, additional, f"{location}.{key}")
        if len(instance) > schema.get("maxProperties", len(instance)):
            raise ContractError(f"{location}: too many properties")
        if "propertyNames" in schema:
            for key in instance:
                validate(key, schema["propertyNames"], f"{location} property name")

    if isinstance(instance, list):
        if len(instance) < schema.get("minItems", 0):
            raise ContractError(f"{location}: too few items")
        if len(instance) > schema.get("maxItems", len(instance)):
            raise ContractError(f"{location}: too many items")
        if "items" in schema:
            for index, value in enumerate(instance):
                validate(value, schema["items"], f"{location}[{index}]")

    if isinstance(instance, str):
        if len(instance) < schema.get("minLength", 0):
            raise ContractError(f"{location}: string is too short")
        if len(instance) > schema.get("maxLength", len(instance)):
            raise ContractError(f"{location}: string is too long")
        if "pattern" in schema and re.search(schema["pattern"], instance) is None:
            raise ContractError(f"{location}: string does not match required pattern")
        if schema.get("format") == "uuid":
            try:
                uuid.UUID(instance)
            except ValueError as exc:
                raise ContractError(f"{location}: invalid UUID") from exc
        if schema.get("format") == "uri":
            parsed = urlparse(instance)
            if not parsed.scheme or not parsed.netloc:
                raise ContractError(f"{location}: invalid URI")
        if schema.get("format") == "date-time":
            try:
                datetime.fromisoformat(instance.replace("Z", "+00:00"))
            except ValueError as exc:
                raise ContractError(f"{location}: invalid date-time") from exc

    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if instance < schema.get("minimum", instance):
            raise ContractError(f"{location}: value is below minimum")
        if instance > schema.get("maximum", instance):
            raise ContractError(f"{location}: value is above maximum")


def enforce_protocol_policy(value: Any, location: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in FORBIDDEN_KEYS:
                raise ContractError(
                    f"{location}.{key}: domain/path escape hatch is forbidden"
                )
            enforce_protocol_policy(child, f"{location}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            enforce_protocol_policy(child, f"{location}[{index}]")
    elif isinstance(value, str) and (
        value.startswith("file://") or WINDOWS_PATH.match(value)
    ):
        raise ContractError(f"{location}: local filesystem path is forbidden")


def validate_task(task: dict[str, Any]) -> None:
    validate(task, load_json(SCHEMA_ROOT / "compute-task.json"))
    enforce_protocol_policy(task)
    task_type = task["task"]["type"]
    validate(
        task["inputs"], load_json(SCHEMA_ROOT / TASK_SCHEMAS[task_type]), "$.inputs"
    )
    if canonical_request_fingerprint(task) != task["requestFingerprint"]:
        raise ContractError(
            "$.requestFingerprint: does not match canonical semantic payload"
        )


def canonical_request_fingerprint(task: dict[str, Any]) -> str:
    artifacts_inputs = [
        {
            key: artifact[key]
            for key in ("artifactId", "role", "mediaType", "sizeBytes", "sha256")
        }
        for artifact in task["artifacts"].get("inputs", [])
    ]
    artifacts_outputs = [
        {
            key: target[key]
            for key in ("artifactId", "role", "mediaType")
        }
        for target in task["artifacts"].get("outputs", [])
    ]
    semantic_payload = {
        "protocolVersion": task["protocolVersion"],
        "task": task["task"],
        "model": task["model"],
        "constraints": {
            "deadline": task["constraints"]["deadline"],
            "maxRuntimeSeconds": task["constraints"]["maxRuntimeSeconds"],
        },
        "inputs": task["inputs"],
        "artifacts": {
            "inputs": artifacts_inputs,
            "outputs": artifacts_outputs,
        },
    }
    canonical = json.dumps(
        semantic_payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def validate_observation(observation: dict[str, Any]) -> None:
    validate(observation, load_json(SCHEMA_ROOT / "compute-observation.json"))
    enforce_protocol_policy(observation)
    if observation["state"] == "FAILED" and "error" not in observation:
        raise ContractError("$.error: failed observation requires error")
    if observation["state"] == "SUCCEEDED" and "error" in observation:
        raise ContractError("$.error: succeeded observation cannot contain error")


def check_all() -> list[str]:
    checked: list[str] = []
    for path in sorted(SCHEMA_ROOT.glob("*.json")):
        if path.name == "artifact-ref.json":
            continue
        schema = load_json(path)
        if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
            raise ContractError(f"{path}: schema draft must be 2020-12")
        checked.append(path.relative_to(ROOT).as_posix())

    for path in sorted(EXAMPLE_ROOT.glob("*-task.json")):
        validate_task(load_json(path))
        checked.append(path.relative_to(ROOT).as_posix())
    for path in sorted(EXAMPLE_ROOT.glob("*-observation.json")):
        validate_observation(load_json(path))
        checked.append(path.relative_to(ROOT).as_posix())

    openapi = (CONTRACT_ROOT / "openapi.yaml").read_text(encoding="utf-8")
    for required in (
        "/v1/capabilities",
        "/v1/tasks",
        ":cancel",
        "/internal/v1/compute-events",
    ):
        if required not in openapi:
            raise ContractError(f"openapi.yaml is missing {required}")
    checked.append((CONTRACT_ROOT / "openapi.yaml").relative_to(ROOT).as_posix())
    return checked


def main() -> int:
    try:
        checked = check_all()
    except (ContractError, json.JSONDecodeError, OSError) as exc:
        print(f"Compute contract check failed: {exc}", file=sys.stderr)
        return 1
    print(f"Compute contract check passed ({len(checked)} files).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
