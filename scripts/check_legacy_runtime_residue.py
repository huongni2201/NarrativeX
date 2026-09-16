#!/usr/bin/env python3
"""Fail when the retired PostgreSQL-polling compute runtime is still active."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY_DIRS = (ROOT / "app" / "ai-worker", ROOT / "app" / "narration-worker")
ACTIVE_PATHS = (
    ROOT / "docker-compose.yml",
    ROOT / ".env.example",
    ROOT / ".github" / "workflows",
    ROOT / "scripts",
    ROOT / "app" / "backend-service",
    ROOT / "app" / "generation-service",
    ROOT / "app" / "desktop",
)
LEGACY_TOKENS = (
    "ai-" + "worker",
    "narration-" + "worker",
    "AI_WORKER_IMAGE",
    "NARRATION_WORKER_IMAGE",
    "WORKER_ROLES",
    "GPU_WORKER_",
    "worker-" + "narration",
    "worker-" + "image",
)

LEGACY_SOURCE_SUFFIXES = frozenset({".py", ".toml", ".md", ".yml", ".yaml"})
LEGACY_SOURCE_NAMES = frozenset({"Dockerfile", ".dockerignore"})


def _iter_files(path: Path):
    if path.is_file():
        yield path
        return
    if not path.exists():
        return
    for child in path.rglob("*"):
        if child.is_file() and not any(
            part in {"target", "node_modules", "__pycache__", ".pytest_cache", ".ruff_cache"}
            for part in child.parts
        ):
            yield child


def main() -> int:
    violations: list[str] = []
    for legacy_dir in LEGACY_DIRS:
        source_files = [
            path
            for path in _iter_files(legacy_dir)
            if path.suffix in LEGACY_SOURCE_SUFFIXES or path.name in LEGACY_SOURCE_NAMES
        ]
        if source_files:
            violations.append(
                f"legacy runtime source tree still exists: {legacy_dir.relative_to(ROOT)}"
            )

    checker = Path(__file__).resolve()
    for root in ACTIVE_PATHS:
        for path in _iter_files(root):
            if path.resolve() == checker:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            for line_number, line in enumerate(text.splitlines(), start=1):
                for token in LEGACY_TOKENS:
                    if token in line:
                        violations.append(
                            f"{path.relative_to(ROOT)}:{line_number}: active legacy token {token}"
                        )

    if violations:
        print("Legacy compute runtime residue check failed:")
        print("\n".join(f"- {item}" for item in violations[:100]))
        return 1
    print("Legacy compute runtime residue check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
