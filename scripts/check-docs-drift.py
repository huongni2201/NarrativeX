#!/usr/bin/env python3
"""Fail on high-confidence NarrativeX current-documentation drift."""

from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

CURRENT_FILES = [
    ROOT / "README.md",
    ROOT / "CONTRIBUTING.md",
    ROOT / "AI_CONTEXT.md",
    ROOT / "app" / "desktop" / "README.md",
    ROOT / "documentation" / "README.md",
    ROOT / "documentation" / "TRACEABILITY.md",
    ROOT / "documentation" / "source-of-truth" / "README.md",
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md",
    ROOT / "documentation" / "codebase" / "CODEBASE_MAP.md",
    ROOT / "documentation" / "codebase" / "DATABASE_BASELINE.md",
    ROOT / "documentation" / "codebase" / "DESKTOP_RENDERER_STRUCTURE.md",
    ROOT / "documentation" / "architecture" / "SYSTEM_ARCHITECTURE.md",
    ROOT / "documentation" / "architecture" / "SERVICE_BOUNDARIES.md",
    ROOT / "documentation" / "architecture" / "DATA_FLOW.md",
    ROOT / "documentation" / "architecture" / "TECHNOLOGY_STACK.md",
    ROOT / "documentation" / "product" / "ROADMAP.md",
    ROOT / "documentation" / "product" / "FEATURE_CATALOG.md",
    ROOT / "documentation" / "workflows" / "AUTHENTICATION.md",
    ROOT / "documentation" / "workflows" / "STORY_TO_VIDEO.md",
    ROOT / "documentation" / "workflows" / "NARRATION_AUDIO.md",
    ROOT / "documentation" / "workflows" / "IMAGE_GENERATION.md",
    ROOT / "documentation" / "workflows" / "VIDEO_GENERATION.md",
]

CANONICAL_CURRENT_FILES = {
    ROOT / "documentation" / "source-of-truth" / "README.md",
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md",
}

REQUIRED_PATHS = [
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md",
    ROOT / "documentation" / "TRACEABILITY.md",
    ROOT / "documentation" / "product" / "FEATURE_CATALOG.md",
    ROOT / "documentation" / "product" / "ROADMAP.md",
    ROOT / "documentation" / "codebase" / "DATABASE_BASELINE.md",
    ROOT / "documentation" / "codebase" / "DESKTOP_RENDERER_STRUCTURE.md",
    ROOT / "documentation" / "workflows" / "AUTHENTICATION.md",
    ROOT / "documentation" / "decisions" / "ADR-0001-system-topology-execution-and-persistence.md",
    ROOT / "documentation" / "decisions" / "ADR-0002-storyboard-character-continuity-and-production-workflows.md",
    ROOT / "documentation" / "decisions" / "ADR-0003-media-storage-generation-pipelines-and-external-integrations.md",
    ROOT / "documentation" / "decisions" / "ADR-0010-desktop-editor-client-boundary.md",
    ROOT / "documentation" / "decisions" / "ADR-0011-google-oauth-only-desktop-auth.md",
    ROOT / "documentation" / "decisions" / "ADR-0012-desktop-local-first-media-and-render-execution.md",
    ROOT / "documentation" / "decisions" / "ADR-0017-desktop-renderer-ui-architecture.md",
]

RETIRED_PATHS = [
    ROOT / "documentation" / "PROJECT_OVERVIEW_API_REPORT.md",
    ROOT / "documentation" / "plans" / "DESKTOP_APP_MIGRATION.md",
    ROOT / "documentation" / "plans" / "DESKTOP_BACKEND_MIGRATION.md",
    ROOT / "documentation" / "codebase" / "PERSISTENCE_MIGRATION.md",
    ROOT / "documentation" / "codebase" / "TRACEABILITY.md",
    ROOT / "app" / "desktop" / "DEPENDENCY_MIGRATION.md",
]

FORBIDDEN = {
    "obsolete current V1.10 authority": re.compile(
        r"(?:canonical|current)\s+(?:source|baseline).*NARRATIVEX_PROJECT_SPEC_V1_10\.md",
        re.IGNORECASE,
    ),
    "obsolete Analyze scaffold token": re.compile(r"FEATURE_NOT_AVAILABLE"),
    "browser still described as primary studio topology": re.compile(
        r"^\s*Browser\s*/\s*Next\.js\s+Studio\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "obsolete Electron 37 current stack": re.compile(r"\bElectron\s+37\b", re.IGNORECASE),
    "obsolete coverage 15 percent gate": re.compile(
        r"(?:Current enforced line gate|jacoco\.minimum\.line\.coverage)[^\n]{0,80}(?:15%|0\.15)",
        re.IGNORECASE,
    ),
    "guest-first feature still migration future": re.compile(
        r"(?:stable|installation)[- ]scoped guest[^\n]{0,100}(?:TARGET|future-only|not implemented)",
        re.IGNORECASE,
    ),
}

DESKTOP_DRIVE_FORBIDDEN_LABEL = "desktop final artifact incorrectly forced to Drive"

DESKTOP_ONLY_FORBIDDEN = {
    "removed web client described as current": re.compile(
        r"(?:`?app/frontend-web`?|legacy\s+(?:next\.js\s+)?web\s+client)\s+"
        r"(?:remains?|is\s+(?:a\s+temporary|temporary|removed\s+only\s+after))",
        re.IGNORECASE,
    ),
    "web removal still marked as target": re.compile(
        r"(?:legacy\s+web\s+removal|app/frontend-web[^\n]{0,40}removal)\s*\|\s*TARGET",
        re.IGNORECASE,
    ),
    "web removal still gated as future work": re.compile(
        r"remove\s+`?app/frontend-web`?\s+only after",
        re.IGNORECASE,
    ),
}

LEGACY_STORAGE_ENV = re.compile(
    r"\b(?:S3_ENDPOINT_URL|S3_BUCKET|S3_REGION|S3_ACCESS_KEY|S3_SECRET_KEY|MINIO_CONSOLE_PORT)\b"
)

CHECKPOINT_PATTERNS = {
    "spec": re.compile(
        r"Docs-sync (?:baseline )?implementation checkpoint:\*\* `[^`]+` at `([0-9a-f]{40})`",
        re.IGNORECASE,
    ),
    "readme": re.compile(
        r"Implementation checkpoint:\s*`[^`]+` at `([0-9a-f]{40})`",
        re.IGNORECASE,
    ),
    "traceability": re.compile(
        r"implementation checkpoint\s+`[^`]+`\s*/\s*`([0-9a-f]{40})`",
        re.IGNORECASE,
    ),
}


def checkpoint_sha(path: Path, pattern: re.Pattern[str]) -> str | None:
    match = pattern.search(path.read_text(encoding="utf-8"))
    return match.group(1) if match else None


def contains_desktop_drive_assertion(text: str) -> bool:
    """Detect a positive Desktop→Google Drive requirement, not a negated warning."""
    for sentence in re.split(r"(?:\r?\n+)|(?<=[.!?])\s+", text):
        if not re.search(r"\bdesktop\b", sentence, re.IGNORECASE):
            continue
        if not re.search(r"\bgoogle\s+drive\b", sentence, re.IGNORECASE):
            continue
        if re.search(
            r"\b(?:must\s+not|should\s+not|does\s+not|do\s+not|never|not\s+required)\b",
            sentence,
            re.IGNORECASE,
        ):
            continue
        if re.search(
            r"\b(?:must|always|has\s+to|needs\s+to|required\s+to)\b[^.!?\n]{0,100}"
            r"\bgoogle\s+drive\b",
            sentence,
            re.IGNORECASE,
        ):
            return True
    return False


def desktop_only_invariant_errors(path: Path, text: str, frontend_web_exists: bool) -> list[str]:
    if frontend_web_exists:
        return []
    return [
        f"{path}: {label}"
        for label, pattern in DESKTOP_ONLY_FORBIDDEN.items()
        if pattern.search(text)
    ]


def check_fixture(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    if contains_desktop_drive_assertion(text):
        print(f"Documentation drift fixture rejected: {path}")
        print(f"- {DESKTOP_DRIVE_FORBIDDEN_LABEL}")
        return 1
    print(f"Documentation drift fixture passed: {path}")
    return 0


def main() -> int:
    if len(sys.argv) > 1:
        if len(sys.argv) != 3 or sys.argv[1] != "--fixture":
            print("usage: check-docs-drift.py [--fixture PATH]", file=sys.stderr)
            return 2
        return check_fixture(Path(sys.argv[2]))

    errors: list[str] = []

    for path in REQUIRED_PATHS:
        if not path.exists():
            errors.append(f"missing required documentation file: {path.relative_to(ROOT)}")

    for path in RETIRED_PATHS:
        if path.exists():
            errors.append(f"retired documentation file returned: {path.relative_to(ROOT)}")

    frontend_web_exists = (ROOT / "app" / "frontend-web").exists()

    for path in CURRENT_FILES:
        if not path.exists():
            errors.append(f"missing current-state doc registered in drift check: {path.relative_to(ROOT)}")
            continue
        text = path.read_text(encoding="utf-8")
        for label, pattern in FORBIDDEN.items():
            if pattern.search(text):
                errors.append(f"{path.relative_to(ROOT)}: {label}")
        if path not in CANONICAL_CURRENT_FILES and contains_desktop_drive_assertion(text):
            errors.append(f"{path.relative_to(ROOT)}: {DESKTOP_DRIVE_FORBIDDEN_LABEL}")
        errors.extend(desktop_only_invariant_errors(path.relative_to(ROOT), text, frontend_web_exists))
        if re.search(r"\bminio\b", text, re.IGNORECASE):
            errors.append(f"{path.relative_to(ROOT)}: MinIO is not part of the current storage contract")
        if LEGACY_STORAGE_ENV.search(text):
            errors.append(f"{path.relative_to(ROOT)}: legacy S3/MinIO environment contract is forbidden")

    spec_path = ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md"
    source_readme_path = ROOT / "documentation" / "source-of-truth" / "README.md"
    traceability_path = ROOT / "documentation" / "TRACEABILITY.md"
    checkpoints = {
        "spec": checkpoint_sha(spec_path, CHECKPOINT_PATTERNS["spec"]),
        "readme": checkpoint_sha(source_readme_path, CHECKPOINT_PATTERNS["readme"]),
        "traceability": checkpoint_sha(traceability_path, CHECKPOINT_PATTERNS["traceability"]),
    }
    missing = [name for name, value in checkpoints.items() if value is None]
    if missing:
        errors.append("missing implementation checkpoint in: " + ", ".join(sorted(missing)))
    elif len(set(checkpoints.values())) != 1:
        errors.append(
            "V1.11 implementation checkpoints disagree: "
            + ", ".join(f"{name}={value}" for name, value in checkpoints.items())
        )

    migrations = ROOT / "app" / "backend-service" / "src" / "main" / "resources" / "db" / "migration"
    expected_migrations = {
        "V1__create_tables.sql",
        "V2__init_indexes.sql",
        "V3__seed_data.sql",
    }
    if migrations.exists():
        actual = {path.name for path in migrations.glob("V*.sql")}
        missing_migrations = sorted(expected_migrations - actual)
        if missing_migrations:
            errors.append("missing current Flyway migration(s): " + ", ".join(missing_migrations))
        unexpected_migrations = sorted(actual - expected_migrations)
        if unexpected_migrations:
            errors.append(
                "unexpected Flyway migration(s) outside consolidated baseline: "
                + ", ".join(unexpected_migrations)
            )

    navigation = (ROOT / "documentation" / "README.md").read_text(encoding="utf-8")
    for retired_name in (
        "DESKTOP_APP_MIGRATION.md",
        "DESKTOP_BACKEND_MIGRATION.md",
        "PROJECT_OVERVIEW_API_REPORT.md",
        "PERSISTENCE_MIGRATION.md",
    ):
        if retired_name in navigation:
            errors.append(f"documentation/README.md links retired doc {retired_name}")

    compose = ROOT / "docker-compose.yml"
    root_env = ROOT / ".env.example"
    for required in (
        "GOOGLE_DRIVE_CLIENT_ID",
        "GOOGLE_DRIVE_CLIENT_SECRET",
        "GOOGLE_DRIVE_REFRESH_TOKEN",
        "GOOGLE_DRIVE_FOLDER_ID",
    ):
        if compose.exists() and required not in compose.read_text(encoding="utf-8"):
            errors.append(f"docker-compose.yml: cloud render fallback is missing {required}")
        if root_env.exists() and required not in root_env.read_text(encoding="utf-8"):
            errors.append(f".env.example: cloud render fallback is missing {required}")

    if root_env.exists():
        root_text = root_env.read_text(encoding="utf-8")
        for required_r2_env in (
            "R2_ACCOUNT_ID",
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "R2_BUCKET",
        ):
            if required_r2_env not in root_text:
                errors.append(f".env.example: cloud/legacy R2 fallback is missing {required_r2_env}")

    if errors:
        print("Documentation drift check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Documentation drift check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
