"""Fail CI when repository guidance contains inline E2E credentials or key material."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
INLINE_PASSWORD_PATTERN = re.compile(
    r"(?i)\b(?:password|passwd)\s*[:=]\s*[`'\"]?([^\s`'\"]+)"
)
NUMERIC_PASSWORD_PATTERN = re.compile(
    r"(?i)\b(?:password|passwd)\s*[:=]\s*[`'\"]?\d{8,}\b"
)
PRIVATE_KEY_PATTERN = re.compile(r"-----BEGIN [A-Z ]+ PRIVATE KEY-----")
TOKEN_PATTERN = re.compile(r"\b(?:ghp|github_pat|xox[baprs])-?[A-Za-z0-9_-]{16,}\b")

GUIDANCE_FILES = {Path("AGENTS.md"), Path(".agents/rules/test-credentials.md")}
PLACEHOLDERS = {
    "",
    "<redacted>",
    "change-me",
    "change-me-local-only",
    "replace-with-test-account-password",
    "hidden",
}


def tracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return [Path(line) for line in result.stdout.splitlines() if line]


def prod_env_is_tracked() -> bool:
    result = subprocess.run(
        ["git", "ls-files", "--error-unmatch", ".env.prod"],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.returncode == 0


def main() -> int:
    violations: list[str] = []
    if prod_env_is_tracked():
        violations.append(".env.prod must not be tracked")
    for path in tracked_files():
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue

        if path in GUIDANCE_FILES:
            if EMAIL_PATTERN.search(text):
                violations.append(f"{path}: inline email address in credential guidance")
            for match in INLINE_PASSWORD_PATTERN.finditer(text):
                value = match.group(1).lower()
                if value not in PLACEHOLDERS and not value.startswith("${"):
                    violations.append(f"{path}: inline password value in credential guidance")

        if NUMERIC_PASSWORD_PATTERN.search(text):
            violations.append(f"{path}: numeric inline password pattern")

        if PRIVATE_KEY_PATTERN.search(text) or TOKEN_PATTERN.search(text):
            violations.append(f"{path}: private key or access token pattern")

    if violations:
        for violation in violations:
            print(violation, file=sys.stderr)
        return 1
    print("secret scan passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
