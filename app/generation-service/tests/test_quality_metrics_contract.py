"""The qualityMetrics wire shape: example, JSON schema and worker model must agree."""

import json
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from narrativex_gpu_worker.contracts.artifact import ProducedArtifact, VideoQualityMetrics
from narrativex_gpu_worker.contracts.observation import ComputeObservation

CONTRACTS = Path(__file__).resolve().parents[3] / "contracts" / "compute" / "v1"


def _example() -> dict[str, Any]:
    return json.loads(
        (CONTRACTS / "examples" / "succeeded-video-observation.json").read_text(encoding="utf-8")
    )


def _schema_quality_properties() -> dict[str, Any]:
    schema = json.loads((CONTRACTS / "schemas" / "produced-artifact.json").read_text("utf-8"))
    quality = schema["properties"]["technicalMetadata"]["properties"]["qualityMetrics"]
    assert quality["additionalProperties"] is False
    return quality["properties"]


def test_example_observation_round_trips_quality_metrics_in_camel_case():
    payload = _example()

    observation = ComputeObservation.model_validate(payload)
    wire = observation.model_dump(mode="json", by_alias=True, exclude_none=True)

    expected = payload["outputs"][0]["technicalMetadata"]["qualityMetrics"]
    assert wire["outputs"][0]["technicalMetadata"]["qualityMetrics"] == expected
    assert expected["status"] == "MEASURED"


def test_schema_declares_exactly_the_fields_the_worker_emits():
    declared = set(_schema_quality_properties())
    emitted = {field.alias or name for name, field in VideoQualityMetrics.model_fields.items()}

    assert declared == emitted


def test_example_uses_only_declared_quality_fields():
    declared = set(_schema_quality_properties())
    sent = set(_example()["outputs"][0]["technicalMetadata"]["qualityMetrics"])

    assert sent <= declared


def test_metadata_without_quality_metrics_is_still_valid():
    payload = _example()["outputs"][0]
    del payload["technicalMetadata"]["qualityMetrics"]

    artifact = ProducedArtifact.model_validate(payload)

    assert artifact.technical_metadata.quality_metrics is None


def test_unknown_quality_field_is_rejected():
    payload = _example()["outputs"][0]
    payload["technicalMetadata"]["qualityMetrics"]["verdict"] = "GOOD"

    with pytest.raises(ValidationError):
        ProducedArtifact.model_validate(payload)


def test_unmeasured_status_must_be_a_known_value():
    payload = _example()["outputs"][0]
    payload["technicalMetadata"]["qualityMetrics"]["status"] = "PASSED"

    with pytest.raises(ValidationError):
        ProducedArtifact.model_validate(payload)
