#!/usr/bin/env python3
"""Fail CI on high-confidence NarrativeX current-documentation drift."""

from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

CURRENT_FILES = [
    ROOT / "README.md",
    ROOT / "AI_CONTEXT.md",
    ROOT / "documentation" / "README.md",
    ROOT / "documentation" / "TRACEABILITY.md",
    ROOT / "documentation" / "PROJECT_OVERVIEW_API_REPORT.md",
    ROOT / "documentation" / "source-of-truth" / "README.md",
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md",
    ROOT / "documentation" / "codebase" / "CODEBASE_MAP.md",
    ROOT / "documentation" / "codebase" / "BACKEND_CODEBASE.md",
    ROOT / "documentation" / "codebase" / "FRONTEND_API_INTEGRATION_MATRIX.md",
    ROOT / "documentation" / "codebase" / "PERSISTENCE_MIGRATION.md",
    ROOT / "documentation" / "architecture" / "SYSTEM_ARCHITECTURE.md",
    ROOT / "documentation" / "architecture" / "SERVICE_BOUNDARIES.md",
    ROOT / "documentation" / "architecture" / "DATA_FLOW.md",
    ROOT / "documentation" / "architecture" / "TECHNOLOGY_STACK.md",
    ROOT / "documentation" / "product" / "PRODUCT_SPEC.md",
    ROOT / "documentation" / "product" / "ROADMAP.md",
    ROOT / "documentation" / "product" / "NARRATIVEX_TIMELINE.md",
    ROOT / "documentation" / "domain" / "DOMAIN_MODEL.md",
    ROOT / "documentation" / "domain" / "BUSINESS_RULES.md",
    ROOT / "documentation" / "workflows" / "STORY_TO_VIDEO.md",
    ROOT / "documentation" / "workflows" / "NARRATION_AUDIO.md",
    ROOT / "app" / "backend-service" / "README.md",
    ROOT / "app" / "ai-worker" / "README.md",
]

REQUIRED_PATHS = [
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md",
    ROOT / "documentation" / "TRACEABILITY.md",
]

FORBIDDEN = {
    "obsolete current V1.10 authority": re.compile(
        r"(?:canonical|current)\s+(?:source|baseline).*NARRATIVEX_PROJECT_SPEC_V1_10\.md",
        re.IGNORECASE,
    ),
    "obsolete V1.8 current baseline": re.compile(r"\bV1\.8\b", re.IGNORECASE),
    "obsolete Analyze scaffold token": re.compile(r"FEATURE_NOT_AVAILABLE"),
    "obsolete media status claim": re.compile(
        r"(?:image generation,?\s*TTS/subtitles\s*(?:and|,)\s*render/export|Image/TTS/render/export)\s+(?:remain|\|)\s*PENDING",
        re.IGNORECASE,
    ),
    "obsolete uploaded-audio target-only claim": re.compile(
        r"uploaded/(?:external )?narration audio\s*\|\s*TARGET", re.IGNORECASE
    ),
    "obsolete three-boundary MyBatis summary": re.compile(
        r"(?:Current MyBatis-backed boundaries include ProviderOperation, Chapter and Project command/query persistence\.|MyBatis persistence for ProviderOperation, Chapter and Project\.|ProviderOperation/Chapter/Project done; other boundaries remain)",
        re.IGNORECASE,
    ),
    "obsolete generation-persistence target": re.compile(
        r"(?:Generation execution persistence|GenerationJob\s*/\s*StageAttempt(?:\s*/\s*OperationPlan\s*/\s*MediaPlan)?[^\n]*)\s*(?:—|\|)\s*TARGET",
        re.IGNORECASE,
    ),
    "obsolete continuity future-gap": re.compile(
        r"location materialization and scene-to-character/location continuity persistence in worker output",
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
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md",
    ROOT / "documentation" / "source-of-truth" / "README.md",
    ROOT / "documentation" / "architecture" / "SYSTEM_ARCHITECTURE.md",
    ROOT / "documentation" / "architecture" / "DATA_FLOW.md",
    ROOT / "documentation" / "architecture" / "TECHNOLOGY_STACK.md",
    ROOT / "documentation" / "codebase" / "CODEBASE_MAP.md",
    ROOT / "documentation" / "decisions" / "ADR-0012-cloudflare-r2-durable-media-storage.md",
    ROOT / "documentation" / "decisions" / "ADR-0011-narration-pipeline-and-worker-runtime.md",
    ROOT / "documentation" / "decisions" / "README.md",
]

LEGACY_STORAGE_ENV = re.compile(
    r"\b(?:S3_ENDPOINT_URL|S3_BUCKET|S3_REGION|S3_ACCESS_KEY|S3_SECRET_KEY|MINIO_CONSOLE_PORT)\b"
)

DOCS_SYNC_PATTERNS = {
    "spec": re.compile(r"Docs-sync base:\*\* `main` at `([0-9a-f]{40})`"),
    "readme": re.compile(r"Docs-sync base: `([0-9a-f]{40})`"),
    "traceability": re.compile(r"docs-sync base `([0-9a-f]{40})`"),
}


def docs_sync_sha(path: Path, pattern: re.Pattern[str]) -> str | None:
    match = pattern.search(path.read_text(encoding="utf-8"))
    return match.group(1) if match else None


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

    spec_path = ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md"
    source_readme_path = ROOT / "documentation" / "source-of-truth" / "README.md"
    traceability_path = ROOT / "documentation" / "TRACEABILITY.md"
    docs_sync_values = {
        "spec": docs_sync_sha(spec_path, DOCS_SYNC_PATTERNS["spec"]),
        "readme": docs_sync_sha(source_readme_path, DOCS_SYNC_PATTERNS["readme"]),
        "traceability": docs_sync_sha(traceability_path, DOCS_SYNC_PATTERNS["traceability"]),
    }
    missing_sync = [name for name, value in docs_sync_values.items() if value is None]
    if missing_sync:
        errors.append(
            "missing docs-sync checkpoint in: " + ", ".join(sorted(missing_sync))
        )
    elif len(set(docs_sync_values.values())) != 1:
        errors.append(
            "V1.11 docs-sync checkpoints disagree: "
            + ", ".join(f"{name}={value}" for name, value in docs_sync_values.items())
        )

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
