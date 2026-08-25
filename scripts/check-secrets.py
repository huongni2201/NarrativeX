"""Detect high-confidence credentials before they can be committed.

The scanner intentionally favors provider-specific signatures and named secret
assignments over broad token heuristics. It scans tracked and non-ignored files,
skips binary files, and allows documentation placeholders and explicit fixture
markers without weakening detection of real-looking values.
"""

from __future__ import annotations

import fnmatch
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Pattern


SAFE_MARKERS = ("secret-scan: allow", "gitleaks:allow")
PLACEHOLDERS = frozenset(
    {
        "",
        "<redacted>",
        "<secret>",
        "<token>",
        "change-me",
        "change-me-local-only",
        "dummy",
        "fake",
        "hidden",
        "placeholder",
        "replace-me",
        "replace-with-test-account-password",
        "test",
        "your-token-here",
    }
)
PLACEHOLDER_PREFIXES = (
    "change-me-",
    "example-",
    "fake-",
    "placeholder-",
    "replace-with-",
    "your-",
)

GUIDANCE_FILES = {Path("AGENTS.md"), Path(".agents/rules/test-credentials.md")}
PRODUCTION_ENV_NAMES = {".env.prod", ".env.production", ".env.prod.local"}


@dataclass(frozen=True)
class SecretRule:
    """A deterministic scanner rule with optional path and capture restrictions."""

    rule_id: str
    pattern: Pattern[str]
    description: str
    file_globs: tuple[str, ...] = ()
    value_group: str | None = None

    def applies_to(self, path: Path) -> bool:
        if not self.file_globs:
            return True
        normalized = path.as_posix()
        return any(
            fnmatch.fnmatch(normalized, glob) or fnmatch.fnmatch(path.name, glob)
            for glob in self.file_globs
        )


@dataclass(frozen=True)
class SecretViolation:
    path: Path
    rule_id: str
    description: str
    line: int

    def format(self) -> str:
        return f"{self.path}: [{self.rule_id}] {self.description} (line {self.line})"


def _credential_assignment(names: str, value_pattern: str = r"[^\s#\"'`]+") -> Pattern[str]:
    return re.compile(
        rf"(?im)\b(?:{names})\b[ \t]*[:=][ \t]*[\"'`]?"
        rf"(?P<value>{value_pattern})"
    )


PRIVATE_KEY_BODY = r"(?:\\n|\s)+[A-Za-z0-9+/=\\\s]{32,}(?:\\n|\s)+"


RULES: tuple[SecretRule, ...] = (
    SecretRule(
        "google-api-key",
        re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
        "Google API key",
    ),
    SecretRule(
        "google-oauth-client-secret",
        re.compile(r"\bGOCSPX-[A-Za-z0-9_-]{20,}\b"),
        "Google OAuth client secret",
    ),
    SecretRule(
        "gcp-service-account-private-key",
        re.compile(
            rf"(?is)\"private_key\"\s*:\s*\"(?P<value>"
            rf"-----BEGIN PRIVATE KEY-----{PRIVATE_KEY_BODY}-----END PRIVATE KEY-----)"
        ),
        "GCP service-account private key",
        ("*.json",),
        "value",
    ),
    SecretRule(
        "cloudflare-tunnel-token",
        _credential_assignment(
            r"(?:CLOUDFLARE_TUNNEL_TOKEN|TUNNEL_TOKEN)",
            r"[A-Za-z0-9._-]{24,}",
        ),
        "Cloudflare Tunnel token",
        value_group="value",
    ),
    SecretRule(
        "aws-or-r2-access-key-id",
        re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
        "AWS or R2 access key ID",
    ),
    SecretRule(
        "aws-or-r2-access-key-assignment",
        _credential_assignment(
            r"(?:AWS|R2)_(?:ACCESS_KEY_ID|ACCESS_KEY)",
            r"(?:AKIA|ASIA)[0-9A-Z]{16}|[A-Za-z0-9_-]{20,}",
        ),
        "AWS or R2 access key assignment",
        value_group="value",
    ),
    SecretRule(
        "aws-or-r2-secret-access-key",
        _credential_assignment(
            r"(?:AWS|R2)_(?:SECRET_ACCESS_KEY|SECRET_KEY)",
            r"[A-Za-z0-9/+_=-]{20,}",
        ),
        "AWS or R2 secret access key",
        value_group="value",
    ),
    SecretRule(
        "github-token",
        re.compile(r"\b(?:gh[pousr][_-]|github_pat_)[A-Za-z0-9_-]{20,}\b"),
        "GitHub token",
    ),
    SecretRule(
        "slack-token",
        re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{16,}\b"),
        "Slack token",
    ),
    SecretRule(
        "authorization-bearer-token",
        re.compile(
            r"(?i)\bAuthorization\b\s*[:=]\s*[\"']?Bearer\s+"
            r"(?P<value>[A-Za-z0-9._~+/=-]{20,})"
        ),
        "Authorization Bearer token",
        value_group="value",
    ),
    SecretRule(
        "jwt-like-token",
        re.compile(
            r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"
        ),
        "JWT-like token",
    ),
    SecretRule(
        "database-url-inline-password",
        re.compile(
            r"(?i)\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis(?:s)?)://"
            r"[^/\s:@]+:(?P<password>[^@\s]+)@(?P<host>[^/\s:]+)"
        ),
        "database URL contains an inline password",
        value_group="password",
    ),
    SecretRule(
        "pem-private-key",
        re.compile(
            rf"-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----{PRIVATE_KEY_BODY}"
            rf"-----END (?:[A-Z0-9]+ )?PRIVATE KEY-----"
        ),
        "PEM private key",
    ),
    SecretRule(
        "env-credential-assignment",
        _credential_assignment(
            r"[A-Z][A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|PRIVATE_KEY|API_KEY|"
            r"ACCESS_KEY|REFRESH_TOKEN)"
        ),
        "non-placeholder credential in environment file",
        (".env", ".env.*", "*.env", "*.env.*"),
        "value",
    ),
    SecretRule(
        "guidance-inline-email",
        re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
        "inline email address in credential guidance",
        tuple(str(path) for path in GUIDANCE_FILES),
    ),
    SecretRule(
        "guidance-inline-password",
        re.compile(
            r"(?i)\b(?:password|passwd)\s*[:=]\s*[`'\"]?"
            r"(?P<value>[^\s`'\"]+)"
        ),
        "inline password value in credential guidance",
        tuple(str(path) for path in GUIDANCE_FILES),
        "value",
    ),
    SecretRule(
        "numeric-inline-password",
        re.compile(r"(?i)\b(?:password|passwd)\s*[:=]\s*[`'\"]?\d{8,}\b"),
        "numeric inline password pattern",
    ),
)


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
        ["git", "ls-files"],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return any(Path(line).name in PRODUCTION_ENV_NAMES for line in result.stdout.splitlines())


def is_placeholder(value: str) -> bool:
    normalized = value.strip().strip("`'\"").lower()
    if normalized in PLACEHOLDERS or normalized.startswith("${"):
        return True
    return any(normalized.startswith(prefix) for prefix in PLACEHOLDER_PREFIXES)


def is_safe_local_database_default(match: re.Match[str]) -> bool:
    """Allow the repository's non-production localhost development default."""
    return (
        match.group("host").lower() in {"localhost", "127.0.0.1"}
        and match.group("password").lower() in {"narrativex", "postgres", "password", "test"}
    )


def is_safe_example_default(path: Path, match: re.Match[str]) -> bool:
    return path.name == ".env.example" and match.group("value").lower() in {
        "narrativex",
        "postgres",
        "password",
        "test",
    }


def is_safe_marker_line(text: str, match: re.Match[str]) -> bool:
    line_start = text.rfind("\n", 0, match.start()) + 1
    line_end = text.find("\n", match.start())
    if line_end == -1:
        line_end = len(text)
    line = text[line_start:line_end].lower()
    return any(marker in line for marker in SAFE_MARKERS)


def scan_text(path: Path, text: str) -> list[SecretViolation]:
    violations: list[SecretViolation] = []
    for rule in RULES:
        if not rule.applies_to(path):
            continue
        for match in rule.pattern.finditer(text):
            if is_safe_marker_line(text, match):
                continue
            if rule.value_group and is_placeholder(match.group(rule.value_group)):
                continue
            if rule.rule_id == "database-url-inline-password" and is_safe_local_database_default(match):
                continue
            if rule.rule_id == "env-credential-assignment" and is_safe_example_default(path, match):
                continue
            line = text.count("\n", 0, match.start()) + 1
            violations.append(SecretViolation(path, rule.rule_id, rule.description, line))
    return violations


def read_text_file(path: Path) -> str | None:
    try:
        data = path.read_bytes()
        if b"\x00" in data:
            return None
        return data.decode("utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def scan_path(path: Path) -> list[SecretViolation]:
    text = read_text_file(path)
    return [] if text is None else scan_text(path, text)


def main() -> int:
    violations: list[SecretViolation] = []
    if prod_env_is_tracked():
        violations.append(
            SecretViolation(
                Path(".env.prod"),
                "tracked-production-env",
                "production environment files must not be tracked",
                1,
            )
        )

    for path in tracked_files():
        if path.is_file():
            violations.extend(scan_path(path))

    if violations:
        for violation in violations:
            print(violation.format(), file=sys.stderr)
        return 1
    print("secret scan passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
