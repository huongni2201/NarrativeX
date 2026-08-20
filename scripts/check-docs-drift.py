#!/usr/bin/env python3
"""Fail CI on high-confidence NarrativeX current-documentation drift."""

from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

CURRENT_FILES = [
    ROOT / "documentation" / "README.md",
    ROOT / "documentation" / "source-of-truth" / "README.md",
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_10.md",
    ROOT / "documentation" / "codebase" / "CODEBASE_MAP.md",
    ROOT / "documentation" / "codebase" / "BACKEND_CODEBASE.md",
    ROOT / "documentation" / "codebase" / "AI_WORKER_CODEBASE.md",
    ROOT / "documentation" / "codebase" / "FRONTEND_CODEBASE.md",
    ROOT / "documentation" / "codebase" / "FRONTEND_API_INTEGRATION_MATRIX.md",
    ROOT / "documentation" / "architecture" / "SYSTEM_ARCHITECTURE.md",
    ROOT / "documentation" / "architecture" / "DATA_FLOW.md",
    ROOT / "documentation" / "architecture" / "SERVICE_BOUNDARIES.md",
    ROOT / "documentation" / "product" / "PRODUCT_SPEC.md",
    ROOT / "documentation" / "product" / "ROADMAP.md",
    ROOT / "documentation" / "product" / "NARRATIVEX_TIMELINE.md",
    ROOT / "documentation" / "domain" / "DOMAIN_MODEL.md",
    ROOT / "documentation" / "domain" / "BUSINESS_RULES.md",
    ROOT / "app" / "backend-service" / "README.md",
    ROOT / "app" / "ai-worker" / "README.md",
]

# TRACEABILITY intentionally explains which historical claims became obsolete, so it is
# validated for existence but excluded from literal stale-phrase scanning.
REQUIRED_PATHS = [
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_10.md",
    ROOT / "documentation" / "TRACEABILITY.md",
]

FORBIDDEN = {
    "obsolete Analyze scaffold token": re.compile(r"FEATURE_NOT_AVAILABLE"),
    "obsolete provider durability claim": re.compile(
        r"dedicated durable [`']?ProviderOperation[`']? (?:persistence|durability).*"
        r"(?:required|pending|not yet complete)",
        re.IGNORECASE,
    ),
    "obsolete continuity claim": re.compile(
        r"(?:does not yet materialize|currently drops|Location materialization\s*\|\s*PENDING|"
        r"Scene character/location continuity materialization\s*\|\s*PENDING)",
        re.IGNORECASE,
    ),
}


def main() -> int:
    errors: list[str] = []

    for path in REQUIRED_PATHS:
        if not path.exists():
            errors.append(f"missing required documentation file: {path.relative_to(ROOT)}")

    for path in CURRENT_FILES:
        if not path.exists():
            errors.append(f"missing current-state doc registered in drift check: {path.relative_to(ROOT)}")
            continue
        text = path.read_text(encoding="utf-8")
        for label, pattern in FORBIDDEN.items():
            if pattern.search(text):
                errors.append(f"{path.relative_to(ROOT)}: {label}")

    navigation = (ROOT / "documentation" / "README.md").read_text(encoding="utf-8")
    for removed_dir in ("./plans/", "./audits/"):
        if removed_dir in navigation:
            errors.append(f"documentation/README.md links removed directory {removed_dir}")

    if errors:
        print("Documentation drift check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Documentation drift check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
