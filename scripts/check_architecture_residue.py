#!/usr/bin/env python3
"""Architecture residue scanner for NarrativeX.

Enforces ADR-0030 and ADR-0028/0029 by detecting forbidden architectural remnants
such as auth/account identity, quota/entitlements, R2 object storage, VieNeu TTS,
and business database coupling in the generation service.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Pattern

ROOT = Path(__file__).resolve().parents[1]

# Directories and files ignored during scanning
IGNORED_DIRS = {
    ".git",
    ".idea",
    ".vscode",
    "node_modules",
    "target",
    "out",
    "dist",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    "旸ǆ",
    "짹ʦ",
}

# Historical docs allowlist where retired concepts are documented as superseded
HISTORICAL_ALLOWLIST = {
    Path("documentation/decisions/ADR-0004-authentication-runtime-security-and-test-credentials.md"),
    Path("documentation/decisions/ADR-0011-google-oauth-only-desktop-auth.md"),
    Path("documentation/decisions/ADR-0022-r2-voice-only-and-voice-reference-scope.md"),
    Path("documentation/decisions/ADR-0025-durable-monthly-export-quota-settlement.md"),
    Path("documentation/decisions/ADR-0027-voicestudio-only-tts-and-whisperx-wav-pipeline.md"),
    Path("documentation/migrations/compute-execution-plane-inventory.md"),
    Path("docs/plans/20260914-compute-execution-plane-migration.md"),
}


@dataclass(frozen=True, slots=True)
class Violation:
    rule_category: str
    term: str
    file_path: Path
    line_number: int
    line_content: str


FORBIDDEN_RULES: dict[str, list[tuple[str, Pattern[str]]]] = {
    "auth_account": [
        ("CurrentUserId", re.compile(r"\bCurrentUserId\b")),
        ("AuthGuard", re.compile(r"\bAuthGuard\b")),
        ("auth_users", re.compile(r"\bauth_users\b")),
        ("desktop_guest_installations", re.compile(r"\bdesktop_guest_installations\b")),
        ("desktop_auth_handoffs", re.compile(r"\bdesktop_auth_handoffs\b")),
        ("SPRING_SESSION", re.compile(r"\bSPRING_SESSION\b")),
        ("NX_SESSION", re.compile(r"\bNX_SESSION\b")),
        ("GOOGLE_OAUTH_CLIENT_ID", re.compile(r"\bGOOGLE_OAUTH_CLIENT_ID\b")),
        ("GOOGLE_OAUTH_CLIENT_SECRET", re.compile(r"\bGOOGLE_OAUTH_CLIENT_SECRET\b")),
        ("owner_id", re.compile(r"\bowner_id\b")),
        ("requested_by_user_id", re.compile(r"\brequested_by_user_id\b")),
    ],
    "quota_plans": [
        ("quota_reservations", re.compile(r"\bquota_reservations\b")),
        ("usage_windows", re.compile(r"\busage_windows\b")),
        ("user_plan_assignments", re.compile(r"\buser_plan_assignments\b")),
        ("plan_entitlements", re.compile(r"\bplan_entitlements\b")),
        ("UserQuotaAccess", re.compile(r"\bUserQuotaAccess\b")),
        ("QuotaMapper", re.compile(r"\bQuotaMapper\b")),
    ],
    "r2_storage": [
        ("R2StorageProperties", re.compile(r"\bR2StorageProperties\b")),
        ("R2ObjectStorageAdapter", re.compile(r"\bR2ObjectStorageAdapter\b")),
        ("R2_BUCKET", re.compile(r"\bR2_BUCKET\b")),
        ("R2_ACCESS_KEY_ID", re.compile(r"\bR2_ACCESS_KEY_ID\b")),
        ("R2_SECRET_ACCESS_KEY", re.compile(r"\bR2_SECRET_ACCESS_KEY\b")),
    ],
    "vieneu_tts": [
        ("VIENEU", re.compile(r"\b(?:VIENEU|VieNeu|vieneu)\b")),
    ],
}

GENERATION_SERVICE_FORBIDDEN: list[tuple[str, Pattern[str]]] = [
    ("DATABASE_URL", re.compile(r"\bDATABASE_URL\b")),
    ("asyncpg", re.compile(r"\basyncpg\b")),
    ("generation_jobs", re.compile(r"\bgeneration_jobs\b")),
    ("stage_attempts", re.compile(r"\bstage_attempts\b")),
    ("provider_operations", re.compile(r"\bprovider_operations\b")),
    ("project_id", re.compile(r"\bproject_id\b")),
    ("chapter_id", re.compile(r"\bchapter_id\b")),
    ("scene_id", re.compile(r"\bscene_id\b")),
    ("visual_beats", re.compile(r"\bvisual_beats\b")),
]


def should_skip(path: Path) -> bool:
    rel_parts = path.relative_to(ROOT).parts
    if any(part in IGNORED_DIRS for part in rel_parts):
        return True
    rel_path = path.relative_to(ROOT)
    if rel_path in HISTORICAL_ALLOWLIST:
        return True
    # Skip the scanner itself and test plans
    if path.resolve() == Path(__file__).resolve():
        return True
    return False


def scan_file(path: Path) -> list[Violation]:
    violations: list[Violation] = []
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return violations

    is_gen_service = (
        "app/generation-service/src" in path.as_posix()
        or "app\\generation-service\\src" in path.as_posix()
    )

    lines = content.splitlines()
    for line_idx, line in enumerate(lines, start=1):
        for category, rules in FORBIDDEN_RULES.items():
            for term, pattern in rules:
                if pattern.search(line):
                    violations.append(
                        Violation(
                            rule_category=category,
                            term=term,
                            file_path=path.relative_to(ROOT),
                            line_number=line_idx,
                            line_content=line.strip(),
                        )
                    )

        if is_gen_service:
            for term, pattern in GENERATION_SERVICE_FORBIDDEN:
                if pattern.search(line):
                    violations.append(
                        Violation(
                            rule_category="generation_service_business_leak",
                            term=term,
                            file_path=path.relative_to(ROOT),
                            line_number=line_idx,
                            line_content=line.strip(),
                        )
                    )

    return violations


def scan_repository() -> list[Violation]:
    all_violations: list[Violation] = []
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for f in files:
            file_path = Path(root) / f
            if should_skip(file_path):
                continue
            # Only scan text/source files
            suffix = file_path.suffix.lower()
            if suffix in {
                ".java",
                ".xml",
                ".sql",
                ".py",
                ".ts",
                ".tsx",
                ".js",
                ".mjs",
                ".json",
                ".yml",
                ".yaml",
                ".md",
                ".env",
                ".example",
                ".toml",
            } or file_path.name in {".env.example", "Dockerfile"}:
                all_violations.extend(scan_file(file_path))
    return all_violations


def main() -> int:
    parser = argparse.ArgumentParser(description="Check for architecture residue.")
    parser.add_argument("--summary", action="store_true", help="Print summary of violations by category")
    parser.add_argument(
        "--category",
        choices=["auth_account", "quota_plans", "r2_storage", "vieneu_tts", "generation_service_business_leak"],
        help="Filter scan by category",
    )
    args = parser.parse_args()

    violations = scan_repository()
    if args.category:
        violations = [v for v in violations if v.rule_category == args.category]

    if not violations:
        print("Architecture residue check passed: zero violations found.")
        return 0

    print(f"Found {len(violations)} architecture residue violations:\n")
    by_category: dict[str, int] = {}
    for v in violations:
        by_category[v.rule_category] = by_category.get(v.rule_category, 0) + 1

    for cat, count in sorted(by_category.items()):
        print(f"  [{cat}]: {count} violations")
    print()

    if not args.summary:
        for v in violations[:50]:  # Display first 50
            print(f"[{v.rule_category}] {v.file_path}:{v.line_number} -> {v.term}: {v.line_content[:100]}")
        if len(violations) > 50:
            print(f"... and {len(violations) - 50} more violations.")

    return 1


if __name__ == "__main__":
    sys.exit(main())
