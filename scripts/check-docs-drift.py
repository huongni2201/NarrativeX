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
    ROOT / "app" / "ai-worker" / "README.md",
    ROOT / "app" / "desktop" / "README.md",
    ROOT / "app" / "generation-service" / "README.md",
    ROOT / "documentation" / "README.md",
    ROOT / "documentation" / "CURRENT_STATUS.md",
    ROOT / "documentation" / "COMPUTE_PROTOCOL.md",
    ROOT / "documentation" / "TRACEABILITY.md",
    ROOT / "documentation" / "source-of-truth" / "README.md",
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_12.md",
    ROOT / "documentation" / "codebase" / "CODEBASE_MAP.md",
    ROOT / "documentation" / "codebase" / "DATABASE_BASELINE.md",
    ROOT / "documentation" / "codebase" / "BACKEND_CODEBASE.md",
    ROOT / "documentation" / "codebase" / "GENERATION_SERVICE_CODEBASE.md",
    ROOT / "documentation" / "codebase" / "DESKTOP_RENDERER_STRUCTURE.md",
    ROOT / "documentation" / "architecture" / "SYSTEM_ARCHITECTURE.md",
    ROOT / "documentation" / "architecture" / "SERVICE_BOUNDARIES.md",
    ROOT / "documentation" / "architecture" / "DATA_FLOW.md",
    ROOT / "documentation" / "architecture" / "TECHNOLOGY_STACK.md",
    ROOT / "documentation" / "product" / "ROADMAP.md",
    ROOT / "documentation" / "product" / "FEATURE_CATALOG.md",
    ROOT / "documentation" / "product" / "PRODUCT_SPEC.md",
    ROOT / "documentation" / "workflows" / "STORY_TO_VIDEO.md",
    ROOT / "documentation" / "workflows" / "NARRATION_AUDIO.md",
    ROOT / "documentation" / "workflows" / "IMAGE_GENERATION.md",
    ROOT / "documentation" / "workflows" / "VIDEO_GENERATION.md",
]

REQUIRED_PATHS = [
    ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_12.md",
    ROOT / "documentation" / "CURRENT_STATUS.md",
    ROOT / "documentation" / "COMPUTE_PROTOCOL.md",
    ROOT / "documentation" / "TRACEABILITY.md",
    ROOT / "documentation" / "product" / "FEATURE_CATALOG.md",
    ROOT / "documentation" / "product" / "ROADMAP.md",
    ROOT / "documentation" / "codebase" / "DATABASE_BASELINE.md",
    ROOT / "documentation" / "codebase" / "DESKTOP_RENDERER_STRUCTURE.md",
    ROOT / "documentation" / "domain" / "DOMAIN_MODEL.md",
    ROOT / "app" / "generation-service" / "README.md",
    ROOT / "documentation" / "decisions" / "ADR-0001-system-topology-execution-and-persistence.md",
    ROOT / "documentation" / "decisions" / "ADR-0002-storyboard-character-continuity-and-production-workflows.md",
    ROOT / "documentation" / "decisions" / "ADR-0003-media-storage-generation-pipelines-and-external-integrations.md",
    ROOT / "documentation" / "decisions" / "ADR-0010-desktop-editor-client-boundary.md",
    ROOT / "documentation" / "decisions" / "ADR-0012-desktop-local-first-media-and-render-execution.md",
    ROOT / "documentation" / "decisions" / "ADR-0017-desktop-renderer-ui-component-stack.md",
    ROOT / "documentation" / "decisions" / "ADR-0028-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md",
    ROOT / "documentation" / "decisions" / "ADR-0029-generation-service-light-ddd-hexagonal-structure.md",
    ROOT / "documentation" / "decisions" / "ADR-0030-single-user-local-first-architecture.md",
    ROOT / "documentation" / "decisions" / "ADR-0031-submission-checkpoint-and-worker-recovery-semantics.md",
]

RETIRED_PATHS = [
    ROOT / "documentation" / "PROJECT_OVERVIEW_API_REPORT.md",
    ROOT / "documentation" / "plans" / "DESKTOP_APP_MIGRATION.md",
    ROOT / "documentation" / "plans" / "DESKTOP_BACKEND_MIGRATION.md",
    ROOT / "documentation" / "codebase" / "PERSISTENCE_MIGRATION.md",
    ROOT / "documentation" / "codebase" / "TRACEABILITY.md",
    ROOT / "documentation" / "workflows" / "AUTHENTICATION.md",
    ROOT / "app" / "desktop" / "DEPENDENCY_MIGRATION.md",
]

FORBIDDEN = {
    "obsolete current V1.10 authority": re.compile(
        r"(?:canonical|current)\s+(?:source|baseline).*NARRATIVEX_PROJECT_SPEC_V1_10\.md",
        re.IGNORECASE,
    ),
    "obsolete current V1.11 authority": re.compile(
        r"(?:canonical|current)\s+(?:source|baseline|specification).*NARRATIVEX_PROJECT_SPEC_V1_11\.md",
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
    "removed Google Drive storage contract": re.compile(r"\bgoogle\s+drive\b", re.IGNORECASE),
    "removed Google Drive environment contract": re.compile(r"\bGOOGLE_DRIVE_[A-Z0-9_]+\b"),
    "removed final-video server storage contract": re.compile(
        r"\b(?:FINAL_VIDEO_STORAGE_MODE|FINAL_VIDEO_LOCAL_DIR|render-worker|worker-render)\b",
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

MIGRATION_NAME = re.compile(r"\b(V(\d+)__[A-Za-z0-9_]+\.sql)\b")

FORBIDDEN_IDENTITY_TERMS = [
    ("guest-first", re.compile(r"\bguest-first\b", re.IGNORECASE)),
    ("Google-only account sign-in", re.compile(r"Google-only account sign-in", re.IGNORECASE)),
    ("desktop_guest_installations", re.compile(r"\bdesktop_guest_installations\b")),
    ("ROLE_GUEST", re.compile(r"\bROLE_GUEST\b")),
    ("ROLE_USER", re.compile(r"\bROLE_USER\b")),
    ("NX_SESSION", re.compile(r"\bNX_SESSION\b")),
    ("AUTHENTICATION_REQUIRED", re.compile(r"\bAUTHENTICATION_REQUIRED\b")),
    ("guest ownership transfer", re.compile(r"guest ownership transfer", re.IGNORECASE)),
    ("account-scoped quota", re.compile(r"account-scoped quota", re.IGNORECASE)),
    ("per-user entitlement", re.compile(r"per-user entitlement", re.IGNORECASE)),
]

ALLOWED_CONTEXT = re.compile(
    r"\b(?:removed|superseded|historical|legacy|migration|retired|prior|former|no|without|eliminated|purged|replaces?)\b",
    re.IGNORECASE,
)

FORBIDDEN_COMPUTE_NAMING = re.compile(r"\bapp/gpu-worker\b")
FORBIDDEN_V8_BASELINE = re.compile(r"\bV1[–-]V8\b|\bV8__seed_catalog\.sql\b")


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


def documented_migrations(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {match.group(1) for match in MIGRATION_NAME.finditer(path.read_text(encoding="utf-8"))}


def migration_inventory_errors(migrations: Path) -> list[str]:
    if not migrations.exists():
        return [f"missing Flyway migration directory: {migrations.relative_to(ROOT)}"]

    actual = {path.name for path in migrations.glob("V*.sql")}
    version_by_name = {
        match.group(1): int(match.group(2))
        for name in actual
        if (match := MIGRATION_NAME.fullmatch(name)) is not None
    }
    malformed = sorted(actual - version_by_name.keys())
    errors: list[str] = []
    if malformed:
        errors.append("malformed Flyway migration name(s): " + ", ".join(malformed))

    names_by_version: dict[int, list[str]] = {}
    for name, version in version_by_name.items():
        names_by_version.setdefault(version, []).append(name)
    duplicate_versions = {
        version: sorted(names)
        for version, names in names_by_version.items()
        if len(names) > 1
    }
    if duplicate_versions:
        errors.append(
            "duplicate Flyway migration version(s): "
            + "; ".join(
                f"V{version}=" + ", ".join(names)
                for version, names in sorted(duplicate_versions.items())
            )
        )

    if version_by_name:
        versions = set(version_by_name.values())
        highest = max(versions)
        if highest != 7:
            errors.append(
                f"Flyway pre-production baseline highest version must be V7, found V{highest}"
            )
        missing_versions = sorted(set(range(1, highest + 1)) - versions)
        if missing_versions:
            errors.append(
                "Flyway migration versions are not contiguous: missing "
                + ", ".join(f"V{version}" for version in missing_versions)
            )

    for doc in (
        ROOT / "documentation" / "codebase" / "CODEBASE_MAP.md",
        ROOT / "documentation" / "codebase" / "DATABASE_BASELINE.md",
    ):
        documented = documented_migrations(doc)
        missing_from_doc = sorted(actual - documented)
        stale_in_doc = sorted(documented - actual)
        relative = doc.relative_to(ROOT)
        if missing_from_doc:
            errors.append(
                f"{relative}: missing Flyway inventory entries: " + ", ".join(missing_from_doc)
            )
        if stale_in_doc:
            errors.append(
                f"{relative}: lists nonexistent Flyway migrations: " + ", ".join(stale_in_doc)
            )

    return errors


def check_stale_identity_and_naming(path: Path, text: str) -> list[str]:
    errors: list[str] = []
    rel_path = path.relative_to(ROOT)
    lines = text.splitlines()

    for idx, line in enumerate(lines, start=1):
        if ALLOWED_CONTEXT.search(line):
            continue

        for term_label, term_pattern in FORBIDDEN_IDENTITY_TERMS:
            if term_pattern.search(line):
                errors.append(
                    f"{rel_path}:{idx}: stale identity architecture term '{term_label}' is forbidden in current docs"
                )

        if FORBIDDEN_COMPUTE_NAMING.search(line):
            errors.append(
                f"{rel_path}:{idx}: stale service directory 'app/gpu-worker' must be 'app/generation-service'"
            )

        if FORBIDDEN_V8_BASELINE.search(line):
            errors.append(
                f"{rel_path}:{idx}: stale Flyway V8 baseline claim; pre-production baseline is V1-V7 only"
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

    for path in CURRENT_FILES:
        if not path.exists():
            errors.append(f"missing current-state doc registered in drift check: {path.relative_to(ROOT)}")
            continue
        text = path.read_text(encoding="utf-8")
        for label, pattern in FORBIDDEN.items():
            if pattern.search(text):
                errors.append(f"{path.relative_to(ROOT)}: {label}")
        errors.extend(desktop_only_invariant_errors(path.relative_to(ROOT), text, frontend_web_exists))
        if re.search(r"\bminio\b", text, re.IGNORECASE):
            errors.append(f"{path.relative_to(ROOT)}: MinIO is not part of the current storage contract")
        if LEGACY_STORAGE_ENV.search(text):
            errors.append(f"{path.relative_to(ROOT)}: legacy S3/MinIO environment contract is forbidden")

        errors.extend(check_stale_identity_and_naming(path, text))

    spec_path = ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_12.md"
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
            "V1.12 implementation checkpoints disagree: "
            + ", ".join(f"{name}={value}" for name, value in checkpoints.items())
        )

    migrations = ROOT / "app" / "backend-service" / "src" / "main" / "resources" / "db" / "migration"
    errors.extend(migration_inventory_errors(migrations))

    navigation = (ROOT / "documentation" / "README.md").read_text(encoding="utf-8")
    for retired_name in (
        "DESKTOP_APP_MIGRATION.md",
        "DESKTOP_BACKEND_MIGRATION.md",
        "PROJECT_OVERVIEW_API_REPORT.md",
        "PERSISTENCE_MIGRATION.md",
        "AUTHENTICATION.md",
    ):
        if retired_name in navigation:
            errors.append(f"documentation/README.md links retired doc {retired_name}")

    if errors:
        print("Documentation drift check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Documentation drift check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
