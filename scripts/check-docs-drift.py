#!/usr/bin/env python3
"""Fail on high-confidence NarrativeX current-documentation drift."""

from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

ROOT_CURRENT_FILES = [
    ROOT / "README.md",
    ROOT / "CONTRIBUTING.md",
    ROOT / "AI_CONTEXT.md",
    ROOT / "app" / "desktop" / "README.md",
    ROOT / "app" / "ai-worker" / "README.md",
]

REQUIRED_PATHS = [
    ROOT / "documentation" / "README.md",
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md",
    ROOT / "documentation" / "source-of-truth" / "README.md",
    ROOT / "documentation" / "TRACEABILITY.md",
    ROOT / "documentation" / "product" / "FEATURE_CATALOG.md",
    ROOT / "documentation" / "product" / "ROADMAP.md",
    ROOT / "documentation" / "codebase" / "DATABASE_BASELINE.md",
    ROOT / "documentation" / "codebase" / "DESKTOP_RENDERER_STRUCTURE.md",
    ROOT / "documentation" / "domain" / "DOMAIN_MODEL.md",
    ROOT / "documentation" / "workflows" / "AUTHENTICATION.md",
    ROOT / "documentation" / "decisions" / "README.md",
    ROOT / "documentation" / "decisions" / "ADR-0001-system-topology-execution-and-persistence.md",
    ROOT / "documentation" / "decisions" / "ADR-0002-storyboard-character-continuity-and-production-workflows.md",
    ROOT / "documentation" / "decisions" / "ADR-0003-media-storage-generation-pipelines-and-external-integrations.md",
    ROOT / "documentation" / "decisions" / "ADR-0010-desktop-editor-client-boundary.md",
    ROOT / "documentation" / "decisions" / "ADR-0011-google-oauth-only-desktop-auth.md",
    ROOT / "documentation" / "decisions" / "ADR-0012-desktop-local-first-media-and-render-execution.md",
    ROOT / "documentation" / "decisions" / "ADR-0015-desktop-render-lifecycle-and-capability-ipc.md",
    ROOT / "documentation" / "decisions" / "ADR-0017-desktop-renderer-ui-component-stack.md",
    ROOT / "documentation" / "decisions" / "ADR-0020-postgresql-only-mvp-runtime-state.md",
    ROOT / "documentation" / "decisions" / "ADR-0021-desktop-gemini-web-image-generation.md",
    ROOT / "docs" / "superpowers" / "plans" / "README.md",
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
        r"^\s*Browser\s*/\s*Next\.js\s+Studio\s*$", re.IGNORECASE | re.MULTILINE
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
    "removed Google Drive environment contract": re.compile(r"\bGOOGLE_DRIVE_[A-Z0-9_]+\b"),
    "removed final-video server storage contract": re.compile(
        r"\b(?:FINAL_VIDEO_STORAGE_MODE|FINAL_VIDEO_LOCAL_DIR|render-worker|worker-render)\b",
        re.IGNORECASE,
    ),
    "superseded Redis topology wording": re.compile(
        r"Redis\s+sessions\s*/\s*transient\s+hints", re.IGNORECASE
    ),
    "Redis described as required current runtime": re.compile(
        r"\bRedis\b\s+(?:is\s+)?(?:a\s+)?(?:required|authoritative)\b",
        re.IGNORECASE,
    ),
}

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
        r"remove\s+`?app/frontend-web`?\s+only after", re.IGNORECASE
    ),
}

LEGACY_STORAGE_ENV = re.compile(
    r"\b(?:S3_ENDPOINT_URL|S3_BUCKET|S3_REGION|S3_ACCESS_KEY|S3_SECRET_KEY|MINIO_CONSOLE_PORT)\b"
)
GOOGLE_DRIVE = re.compile(r"\bgoogle\s+drive\b", re.IGNORECASE)
NEGATED_OR_HISTORICAL = re.compile(
    r"\b(?:not|no longer|removed|deprecated|historical|superseded|retired|former|obsolete)\b",
    re.IGNORECASE,
)

CHECKPOINT_FILES = {
    "spec": (
        ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md",
        re.compile(
            r"Docs-sync (?:baseline )?implementation checkpoint:\*\* `[^`]+` at `([0-9a-f]{40})`",
            re.IGNORECASE,
        ),
    ),
    "source-readme": (
        ROOT / "documentation" / "source-of-truth" / "README.md",
        re.compile(
            r"(?:Baseline )?implementation checkpoint:\s*`[^`]+` at `([0-9a-f]{40})`",
            re.IGNORECASE,
        ),
    ),
    "traceability": (
        ROOT / "documentation" / "TRACEABILITY.md",
        re.compile(
            r"(?:baseline|current) implementation checkpoint\s+`[^`]+`\s*/\s*`([0-9a-f]{40})`",
            re.IGNORECASE,
        ),
    ),
    "feature-catalog": (
        ROOT / "documentation" / "product" / "FEATURE_CATALOG.md",
        re.compile(r"audited code checkpoint\s+`([0-9a-f]{40})`", re.IGNORECASE),
    ),
    "roadmap": (
        ROOT / "documentation" / "product" / "ROADMAP.md",
        re.compile(
            r"Current audited code checkpoint:\*\* `[^`]+` at `([0-9a-f]{40})`",
            re.IGNORECASE,
        ),
    ),
}

PLAN_STATUSES = ("ACTIVE", "COMPLETED", "SUPERSEDED")


def current_document_paths(root: Path = ROOT) -> list[Path]:
    """Return every Markdown file that is intended to describe current state."""
    paths = [path for path in ROOT_CURRENT_FILES if path.exists()]
    documentation = root / "documentation"
    if documentation.exists():
        for path in documentation.rglob("*.md"):
            if path.parent == documentation / "decisions" and path.name.startswith("ADR-"):
                continue
            paths.append(path)
    return sorted(set(paths))


def checkpoint_sha(path: Path, pattern: re.Pattern[str]) -> str | None:
    match = pattern.search(path.read_text(encoding="utf-8"))
    return match.group(1) if match else None


def desktop_only_invariant_errors(path: Path, text: str, frontend_web_exists: bool) -> list[str]:
    if frontend_web_exists:
        return []
    return [
        f"{path}: {label}"
        for label, pattern in DESKTOP_ONLY_FORBIDDEN.items()
        if pattern.search(text)
    ]


def google_drive_invariant_errors(path: Path, text: str) -> list[str]:
    """Flag Google Drive only when current docs describe it as an active contract."""
    errors: list[str] = []
    for line in text.splitlines():
        if not GOOGLE_DRIVE.search(line):
            continue
        if NEGATED_OR_HISTORICAL.search(line):
            continue
        errors.append(f"{path}: removed Google Drive storage contract")
    return errors


def decision_index_errors(
    decisions_dir: Path | None = None, index_path: Path | None = None
) -> list[str]:
    decisions_dir = decisions_dir or ROOT / "documentation" / "decisions"
    index_path = index_path or decisions_dir / "README.md"
    if not decisions_dir.exists() or not index_path.exists():
        return []
    index = index_path.read_text(encoding="utf-8")
    return [
        f"documentation/decisions/README.md does not index {adr.name}"
        for adr in sorted(decisions_dir.glob("ADR-*.md"))
        if adr.name not in index
    ]


def plan_index_errors(
    plans_dir: Path | None = None, index_path: Path | None = None
) -> list[str]:
    plans_dir = plans_dir or ROOT / "docs" / "superpowers" / "plans"
    index_path = index_path or plans_dir / "README.md"
    if not plans_dir.exists():
        return []
    plans = sorted(path for path in plans_dir.glob("*.md") if path.name != "README.md")
    if not plans:
        return []
    if not index_path.exists():
        return ["docs/superpowers/plans/README.md is required when implementation plans exist"]
    index = index_path.read_text(encoding="utf-8")
    errors: list[str] = []
    status_pattern = "|".join(PLAN_STATUSES)
    for plan in plans:
        row = re.compile(
            rf"{re.escape(plan.name)}[^\n]*\|\s*({status_pattern})\s*\|",
            re.IGNORECASE,
        )
        if not row.search(index):
            errors.append(
                f"docs/superpowers/plans/README.md must index {plan.name} with status "
                + "/".join(PLAN_STATUSES)
            )
    return errors


def main() -> int:
    errors: list[str] = []

    for path in REQUIRED_PATHS:
        if not path.exists():
            errors.append(f"missing required documentation file: {path.relative_to(ROOT)}")
    for path in RETIRED_PATHS:
        if path.exists():
            errors.append(f"retired documentation file returned: {path.relative_to(ROOT)}")

    frontend_web_exists = (ROOT / "app" / "frontend-web").exists()
    current_paths = current_document_paths()
    for path in current_paths:
        text = path.read_text(encoding="utf-8")
        relative = path.relative_to(ROOT)
        for label, pattern in FORBIDDEN.items():
            if pattern.search(text):
                errors.append(f"{relative}: {label}")
        errors.extend(desktop_only_invariant_errors(relative, text, frontend_web_exists))
        errors.extend(google_drive_invariant_errors(relative, text))
        if re.search(r"\bminio\b", text, re.IGNORECASE):
            errors.append(f"{relative}: MinIO is not part of the current storage contract")
        if LEGACY_STORAGE_ENV.search(text):
            errors.append(f"{relative}: legacy S3/MinIO environment contract is forbidden")

    errors.extend(decision_index_errors())
    errors.extend(plan_index_errors())

    checkpoints = {
        name: checkpoint_sha(path, pattern)
        for name, (path, pattern) in CHECKPOINT_FILES.items()
        if path.exists()
    }
    missing = [name for name in CHECKPOINT_FILES if checkpoints.get(name) is None]
    if missing:
        errors.append("missing implementation checkpoint in: " + ", ".join(sorted(missing)))
    elif len(set(checkpoints.values())) != 1:
        errors.append(
            "V1.11 implementation checkpoints disagree: "
            + ", ".join(f"{name}={value}" for name, value in checkpoints.items())
        )

    migrations = ROOT / "app" / "backend-service" / "src" / "main" / "resources" / "db" / "migration"
    expected_migrations = {
        "V1__identity_and_access.sql",
        "V2__project_story_and_planning.sql",
        "V3__generation_billing_and_media.sql",
        "V4__narration_notifications_and_artifacts.sql",
        "V5__catalog_generation_and_render_snapshots.sql",
        "V6__database_logic_and_triggers.sql",
        "V7__indexes.sql",
        "V8__seed_catalog.sql",
    }
    if migrations.exists():
        actual = {path.name for path in migrations.glob("V*.sql")}
        missing_migrations = sorted(expected_migrations - actual)
        if missing_migrations:
            errors.append("missing current Flyway migration(s): " + ", ".join(missing_migrations))
        unexpected_migrations = sorted(actual - expected_migrations)
        if unexpected_migrations:
            errors.append(
                "unexpected Flyway migration(s) outside clean pre-release baseline: "
                + ", ".join(unexpected_migrations)
            )

    navigation_path = ROOT / "documentation" / "README.md"
    if navigation_path.exists():
        navigation = navigation_path.read_text(encoding="utf-8")
        for retired_name in (
            "DESKTOP_APP_MIGRATION.md",
            "DESKTOP_BACKEND_MIGRATION.md",
            "PROJECT_OVERVIEW_API_REPORT.md",
            "PERSISTENCE_MIGRATION.md",
        ):
            if retired_name in navigation:
                errors.append(f"documentation/README.md links retired doc {retired_name}")

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
                errors.append(f".env.example: generated-media R2 transport is missing {required_r2_env}")

    if errors:
        print("Documentation drift check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Documentation drift check passed across {len(current_paths)} current Markdown files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
