#!/usr/bin/env python3
"""Validate V1.11 documentation checkpoint semantics against Git history."""

from __future__ import annotations

from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TRACEABILITY = ROOT / "documentation" / "TRACEABILITY.md"
SPEC = ROOT / "documentation" / "source-of-truth" / "NARRATIVEX_PROJECT_SPEC_V1_11.md"
SOURCE_README = ROOT / "documentation" / "source-of-truth" / "README.md"

PATTERNS = {
    "spec": re.compile(r"Docs-sync (?:baseline )?implementation checkpoint:\*\* `[^`]+` at `([0-9a-f]{40})`"),
    "readme": re.compile(r"(?:Baseline )?implementation checkpoint: `[^`]+` at `([0-9a-f]{40})`", re.IGNORECASE),
    "traceability": re.compile(
        r"(?:baseline|current) implementation checkpoint `[^`]+` / `([0-9a-f]{40})`"
    ),
}


def _sha(path: Path, pattern: re.Pattern[str]) -> str:
    match = pattern.search(path.read_text(encoding="utf-8"))
    if match is None:
        raise SystemExit(f"Missing baseline implementation checkpoint in {path.relative_to(ROOT)}")
    return match.group(1)


def _git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def main() -> int:
    trace_text = TRACEABILITY.read_text(encoding="utf-8")
    if "Current Implementation Traceability" in trace_text:
        raise SystemExit(
            "TRACEABILITY.md must describe its historical checkpoint as a baseline, not current HEAD"
        )
    if not trace_text.startswith("# NarrativeX V1.11 Baseline Implementation Traceability"):
        raise SystemExit("TRACEABILITY.md must use the V1.11 baseline traceability heading")

    checkpoints = {
        "spec": _sha(SPEC, PATTERNS["spec"]),
        "readme": _sha(SOURCE_README, PATTERNS["readme"]),
        "traceability": _sha(TRACEABILITY, PATTERNS["traceability"]),
    }
    if len(set(checkpoints.values())) != 1:
        raise SystemExit(
            "V1.11 baseline checkpoints disagree: "
            + ", ".join(f"{name}={value}" for name, value in checkpoints.items())
        )

    checkpoint = next(iter(checkpoints.values()))
    exists = _git("cat-file", "-e", f"{checkpoint}^{{commit}}")
    if exists.returncode != 0:
        raise SystemExit(f"Documented baseline checkpoint is not available in Git history: {checkpoint}")

    ancestor = _git("merge-base", "--is-ancestor", checkpoint, "HEAD")
    if ancestor.returncode != 0:
        raise SystemExit(
            f"Documented baseline checkpoint {checkpoint} is not an ancestor of the checked-out HEAD"
        )

    print(f"Documentation checkpoint semantics passed: baseline={checkpoint}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
