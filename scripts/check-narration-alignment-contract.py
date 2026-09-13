#!/usr/bin/env python3
"""Fail when narration word-alignment producers/consumers drift from the shared contract."""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "narration-word-alignment.v1.json"
PRODUCER = (
    ROOT
    / "app"
    / "ai-worker"
    / "src"
    / "narrativex_worker"
    / "narration"
    / "repository"
    / "completion.py"
)
CONSUMERS = [
    ROOT
    / "app"
    / "backend-service"
    / "src"
    / "main"
    / "resources"
    / "mybatis"
    / "ProductionTimelineMapper.xml",
    ROOT
    / "app"
    / "backend-service"
    / "src"
    / "main"
    / "resources"
    / "mybatis"
    / "ProjectRenderInputSnapshotMapper.xml",
]
LEGACY_VERSION = "word-whisper-v1"


def main() -> int:
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    version = contract["alignmentVersion"]
    errors: list[str] = []

    if contract.get("timingAuthority") != "MEASURED_WORD_TIMESTAMPS":
        errors.append("contract timingAuthority must remain MEASURED_WORD_TIMESTAMPS")
    if contract.get("allowProportionalFallback") is not False:
        errors.append("contract must keep proportional subtitle fallback disabled")

    for path in [PRODUCER, *CONSUMERS]:
        text = path.read_text(encoding="utf-8")
        relative = path.relative_to(ROOT)
        if version not in text:
            errors.append(f"{relative}: missing canonical alignment version {version}")
        if LEGACY_VERSION in text:
            errors.append(f"{relative}: legacy alignment version {LEGACY_VERSION} returned")

    if errors:
        print("Narration alignment contract check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Narration alignment contract check passed ({version}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
