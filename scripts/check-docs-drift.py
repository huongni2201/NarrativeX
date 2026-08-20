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

R2_ONLY_FILES = [
    ROOT / "README.md",
    ROOT / ".env.example",
    ROOT / "docker-compose.yml",
    ROOT / "app" / "ai-worker" / ".env.example",
    ROOT / "app" / "ai-worker" / "README.md",
    ROOT / "app" / "ai-worker" / "src" / "narrativex_worker" / "config.py",
    ROOT / "app" / "ai-worker" / "src" / "narrativex_worker" / "narration" / "storage.py",
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_10.md",
    ROOT / "documentation" / "source-of-truth" / "README.md",
    ROOT / "documentation" / "architecture" / "SYSTEM_ARCHITECTURE.md",
    ROOT / "documentation" / "architecture" / "DATA_FLOW.md",
    ROOT / "documentation" / "architecture" / "SERVICE_BOUNDARIES.md",
    ROOT / "documentation" / "architecture" / "TECHNOLOGY_STACK.md",
    ROOT / "documentation" / "codebase" / "CODEBASE_MAP.md",
    ROOT / "documentation" / "decisions" / "ADR-0016-cloudflare-r2-generated-image-durability.md",
    ROOT / "documentation" / "decisions" / "ADR-0018-full-chapter-narration-and-alignment.md",
    ROOT / "documentation" / "decisions" / "README.md",
]

LEGACY_STORAGE_ENV = re.compile(
    r"\b(?:S3_ENDPOINT_URL|S3_BUCKET|S3_REGION|S3_ACCESS_KEY|S3_SECRET_KEY|MINIO_CONSOLE_PORT)\b"
)


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

    for path in R2_ONLY_FILES:
        if not path.exists():
            errors.append(f"missing R2-only contract file: {path.relative_to(ROOT)}")
            continue
        text = path.read_text(encoding="utf-8")
        if re.search(r"\bminio\b", text, re.IGNORECASE):
            errors.append(f"{path.relative_to(ROOT)}: MinIO is not part of the R2-only storage contract")
        if LEGACY_STORAGE_ENV.search(text):
            errors.append(f"{path.relative_to(ROOT)}: legacy S3/MinIO environment contract is forbidden")

    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    if "R2_ACCOUNT_ID" not in compose or "R2_BUCKET" not in compose:
        errors.append("docker-compose.yml: worker R2 configuration is missing")

    root_env = (ROOT / ".env.example").read_text(encoding="utf-8")
    for required_r2_env in (
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
    ):
        if required_r2_env not in root_env:
            errors.append(f".env.example: missing {required_r2_env}")

    if errors:
        print("Documentation drift check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Documentation drift check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
