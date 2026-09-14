from __future__ import annotations

from copy import deepcopy

import pytest
from pydantic import ValidationError

from conftest import task_payload
from narrativex_gpu_worker.contracts import ComputeTask, request_fingerprint


def test_contract_example_is_accepted() -> None:
    task = ComputeTask.model_validate(task_payload())
    assert task.task.type == "audio.synthesize"
    assert task.model.executor == "voicestudio"
    assert request_fingerprint(task) == task.request_fingerprint


def test_unknown_fields_are_rejected() -> None:
    payload = task_payload()
    payload["inputs"]["metadata"] = {}
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        ComputeTask.model_validate(payload)


def test_task_type_must_match_closed_input_schema() -> None:
    payload = deepcopy(task_payload())
    payload["task"]["type"] = "image.generate"
    with pytest.raises(ValidationError, match="inputs do not match task.type"):
        ComputeTask.model_validate(payload)


def test_fingerprint_ignores_attempt_and_expiring_access_descriptor() -> None:
    original_payload = task_payload()
    original = ComputeTask.model_validate(original_payload)
    changed_payload = deepcopy(original_payload)
    changed_payload["attemptId"] = "0199b862-1025-78be-bd71-c6969b74ab99"
    changed_payload["constraints"]["deadline"] = "2026-09-15T12:00:00Z"
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
