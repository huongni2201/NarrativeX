"""Pure helpers for continuity persistence payloads and immutable hashes."""

from __future__ import annotations

import json

from narrativex_worker.continuity.schema import ContinuityReport
from narrativex_worker.repository.analysis_fingerprint import result_fingerprint


def json_array(values: list[object]) -> str:
    return json.dumps(
        [
            value.model_dump(mode="json", by_alias=True)
            if hasattr(value, "model_dump")
            else value
            for value in values
        ],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def semantic_hash(value: object) -> str:
    _, digest = result_fingerprint(value)
    return digest


def report_origin(report: ContinuityReport) -> str:
    origins = {issue.origin.value for issue in report.issues}
    if "HUMAN" in origins:
        return "HUMAN"
    if "SEMANTIC" in origins:
        return "SEMANTIC"
    return "DETERMINISTIC"
