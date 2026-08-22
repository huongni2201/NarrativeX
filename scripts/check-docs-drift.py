#!/usr/bin/env python3
"""Fail on high-confidence NarrativeX current-documentation drift."""

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
    ROOT / "documentation" / "architecture" / "SYSTEM_ARCHITECTURE.md",
    ROOT / "documentation" / "architecture" / "SERVICE_BOUNDARIES.md",
    ROOT / "documentation" / "architecture" / "DATA_FLOW.md",
    ROOT / "documentation" / "architecture" / "TECHNOLOGY_STACK.md",
    ROOT / "documentation" / "product" / "ROADMAP.md",
    ROOT / "documentation" / "product" / "FEATURE_CATALOG.md",
    ROOT / "documentation" / "workflows" / "STORY_TO_VIDEO.md",
    ROOT / "documentation" / "workflows" / "NARRATION_AUDIO.md",
]

REQUIRED_PATHS = [
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md",
    ROOT / "documentation" / "TRACEABILITY.md",
    ROOT / "documentation" / "product" / "FEATURE_CATALOG.md",
    ROOT / "documentation" / "decisions" / "ADR-0001-system-topology-execution-and-persistence.md",
    ROOT / "documentation" / "decisions" / "ADR-0002-storyboard-character-continuity-and-production-workflows.md",
    ROOT / "documentation" / "decisions" / "ADR-0003-media-storage-generation-pipelines-and-external-integrations.md",
    ROOT / "documentation" / "decisions" / "ADR-0004-authentication-runtime-security-and-test-credentials.md",
]

FORBIDDEN = {
    "obsolete current V1.10 authority": re.compile(
        r"(?:canonical|current)\s+(?:source|baseline).*NARRATIVEX_PROJECT_SPEC_V1_10\.md",
        re.IGNORECASE,
    ),
    "obsolete V1.8 current baseline": re.compile(r"\bV1\.8\b", re.IGNORECASE),
    "obsolete Analyze scaffold token": re.compile(r"FEATURE_NOT_AVAILABLE"),
    "obsolete R2-only durable-media claim": re.compile(
        r"(?:R2|Cloudflare R2)\s+(?:is|remains)\s+the\s+(?:sole|only)\s+durable\s+(?:binary-)?media",
        re.IGNORECASE,
    ),
    "obsolete R2-backed final artifact claim": re.compile(
        r"(?:validated\s+)?R2[- ]backed\s+FinalArtifact|FinalArtifact\s+(?:in|to)\s+R2|private\s+R2\s+(?:final|persistence)",
        re.IGNORECASE,
    ),
    "obsolete image-generation target claim": re.compile(
        r"Production image generation\s*\|\s*TARGET",
        re.IGNORECASE,
    ),
    "obsolete render target claim": re.compile(
        r"IMAGE_MOTION (?:render/export|renderer)\s*\|\s*TARGET",
        re.IGNORECASE,
    ),
    "obsolete Drive implementation target claim": re.compile(
        r"FinalVideoStorage[^\n]*(?:implementation|Google Drive)[^\n]*(?:TARGET|gap)",
        re.IGNORECASE,
    ),
    "obsolete three-boundary MyBatis summary": re.compile(
        r"(?:ProviderOperation/Chapter/Project done; other boundaries remain|Current MyBatis-backed boundaries include ProviderOperation, Chapter and Project)",
        re.IGNORECASE,
    ),
}

LEGACY_STORAGE_ENV = re.compile(
    r"\b(?:S3_ENDPOINT_URL|S3_BUCKET|S3_REGION|S3_ACCESS_KEY|S3_SECRET_KEY|MINIO_CONSOLE_PORT)\b"
)

IMPLEMENTATION_CHECKPOINT_PATTERNS = {
    "spec": re.compile(r"Docs-sync implementation checkpoint:\*\* `[^`]+` at `([0-9a-f]{40})`"),
    "readme": re.compile(r"Implementation checkpoint: `[^`]+` at `([0-9a-f]{40})`"),
    "traceability": re.compile(r"implementation checkpoint `[^`]+` / `([0-9a-f]{40})`"),
}


def checkpoint_sha(path: Path, pattern: re.Pattern[str]) -> str | None:
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
        if re.search(r"\bminio\b", text, re.IGNORECASE):
            errors.append(f"{path.relative_to(ROOT)}: MinIO is not part of the current storage contract")
        if LEGACY_STORAGE_ENV.search(text):
            errors.append(f"{path.relative_to(ROOT)}: legacy S3/MinIO environment contract is forbidden")

    spec_path = ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md"
    source_readme_path = ROOT / "documentation" / "source-of-truth" / "README.md"
    traceability_path = ROOT / "documentation" / "TRACEABILITY.md"
    checkpoints = {
        "spec": checkpoint_sha(spec_path, IMPLEMENTATION_CHECKPOINT_PATTERNS["spec"]),
        "readme": checkpoint_sha(source_readme_path, IMPLEMENTATION_CHECKPOINT_PATTERNS["readme"]),
        "traceability": checkpoint_sha(traceability_path, IMPLEMENTATION_CHECKPOINT_PATTERNS["traceability"]),
    }
    missing = [name for name, value in checkpoints.items() if value is None]
    if missing:
        errors.append("missing implementation checkpoint in: " + ", ".join(sorted(missing)))
    elif len(set(checkpoints.values())) != 1:
        errors.append(
            "V1.11 implementation checkpoints disagree: "
            + ", ".join(f"{name}={value}" for name, value in checkpoints.items())
        )

    navigation = (ROOT / "documentation" / "README.md").read_text(encoding="utf-8")
    for removed_dir in ("./plans/", "./audits/"):
        if removed_dir in navigation:
            errors.append(f"documentation/README.md links removed directory {removed_dir}")

    prod_compose = ROOT / "docker-compose.prod.yml"
    prod_env = ROOT / ".env.prod.example"
    for required in ("GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET", "GOOGLE_DRIVE_REFRESH_TOKEN", "GOOGLE_DRIVE_FOLDER_ID"):
        if prod_compose.exists() and required not in prod_compose.read_text(encoding="utf-8"):
            errors.append(f"docker-compose.prod.yml: render worker is missing {required}")
        if prod_env.exists() and required not in prod_env.read_text(encoding="utf-8"):
            errors.append(f".env.prod.example: missing {required}")

    root_env = ROOT / ".env.example"
    if root_env.exists():
        root_text = root_env.read_text(encoding="utf-8")
        for required_r2_env in (
            "R2_ACCOUNT_ID",
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "R2_BUCKET",
        ):
            if required_r2_env not in root_text:
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
