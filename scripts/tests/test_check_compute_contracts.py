from __future__ import annotations

import copy
import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "check_compute_contracts", ROOT / "scripts" / "check_compute_contracts.py"
)
assert SPEC is not None and SPEC.loader is not None
contracts = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(contracts)


def valid_task() -> dict[str, object]:
    return contracts.load_json(
        ROOT
        / "contracts"
        / "compute"
        / "v1"
        / "examples"
        / "audio-synthesize-task.json"
    )


def test_checked_in_contracts_are_valid() -> None:
    checked = contracts.check_all()
    assert "contracts/compute/v1/openapi.yaml" in checked


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("projectId", "0199b861-cc3c-7a8e-a915-e5dbff3af700"),
        ("chapterId", "0199b861-cc3c-7a8e-a915-e5dbff3af701"),
        ("metadata", {}),
        ("path", "C:\\media\\input.wav"),
    ],
)
def test_domain_and_path_escape_hatches_are_rejected(key: str, value: object) -> None:
    task = valid_task()
    task["inputs"][key] = value  # type: ignore[index]
    with pytest.raises(contracts.ContractError):
        contracts.validate_task(task)


def test_file_url_is_rejected_even_inside_an_allowed_field() -> None:
    task = valid_task()
    task["inputs"]["script"] = "file:///C:/secret.txt"  # type: ignore[index]
    with pytest.raises(contracts.ContractError, match="filesystem path"):
        contracts.validate_task(task)


def test_unknown_top_level_field_is_rejected() -> None:
    task = valid_task()
    task["extra"] = "not allowed"
    with pytest.raises(contracts.ContractError, match="additional property"):
        contracts.validate_task(task)


def test_invalid_digest_is_rejected() -> None:
    task = contracts.load_json(
        ROOT / "contracts" / "compute" / "v1" / "examples" / "audio-align-task.json"
    )
    task["artifacts"][0]["sha256"] = "not-a-digest"
    with pytest.raises(contracts.ContractError, match="pattern"):
        contracts.validate_task(task)


def test_task_type_and_input_schema_must_match() -> None:
    task = valid_task()
    task["task"]["type"] = "image.generate"  # type: ignore[index]
    with pytest.raises(contracts.ContractError):
        contracts.validate_task(task)


def test_incompatible_protocol_version_is_rejected() -> None:
    task = valid_task()
    task["protocolVersion"] = "2.0"
    with pytest.raises(contracts.ContractError, match="constant"):
        contracts.validate_task(task)


def test_openapi_documents_idempotency_conflict() -> None:
    openapi = (ROOT / "contracts" / "compute" / "v1" / "openapi.yaml").read_text(
        encoding="utf-8"
    )
    assert (
        '"409": {description: Identifier or idempotency-key fingerprint conflict}'
        in openapi
    )


def test_failed_observation_requires_error() -> None:
    observation = contracts.load_json(
        ROOT / "contracts" / "compute" / "v1" / "examples" / "failed-observation.json"
    )
    invalid = copy.deepcopy(observation)
    del invalid["error"]
    with pytest.raises(contracts.ContractError, match="requires error"):
        contracts.validate_observation(invalid)


def test_succeeded_observation_rejects_error() -> None:
    observation = contracts.load_json(
        ROOT
        / "contracts"
        / "compute"
        / "v1"
        / "examples"
        / "succeeded-observation.json"
    )
    observation["error"] = {
        "code": "SHOULD_NOT_EXIST",
        "category": "PERMANENT",
        "message": "terminal contradiction",
        "retryAfterSeconds": None,
        "details": {},
    }
    with pytest.raises(contracts.ContractError, match="cannot contain error"):
        contracts.validate_observation(observation)
