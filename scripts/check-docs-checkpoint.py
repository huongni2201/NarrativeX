#!/usr/bin/env python3
"""Validate NarrativeX documentation checkpoint semantics against Git history."""

from __future__ import annotations

from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]

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

ALLOWED_POST_CHECKPOINT_EXACT = {
    "README.md",
    "CONTRIBUTING.md",
    "AI_CONTEXT.md",
    "app/desktop/README.md",
    "app/ai-worker/README.md",
    "scripts/check-docs-drift.py",
    "scripts/check-docs-checkpoint.py",
    "scripts/test_check_docs_drift.py",
    "scripts/test_check_docs_checkpoint.py",
    "scripts/quality-gates.py",
    "scripts/verify-local.py",
    "scripts/verify-local.ps1",
    "scripts/verify-local.sh",
}

ALLOWED_POST_CHECKPOINT_PREFIXES = (
    "documentation/",
    "docs/superpowers/",
)


def _sha(path: Path, pattern: re.Pattern[str]) -> str:
    match = pattern.search(path.read_text(encoding="utf-8"))
    if match is None:
        raise SystemExit(f"Missing implementation checkpoint in {path.relative_to(ROOT)}")
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


def is_allowed_post_checkpoint_path(path: str) -> bool:
    normalized = path.replace("\\", "/").lstrip("./")
    return normalized in ALLOWED_POST_CHECKPOINT_EXACT or normalized.startswith(
        ALLOWED_POST_CHECKPOINT_PREFIXES
    )


def non_documentation_changes(paths: list[str]) -> list[str]:
    return sorted(path for path in paths if path and not is_allowed_post_checkpoint_path(path))


def main() -> int:
    traceability = ROOT / "documentation" / "TRACEABILITY.md"
    trace_text = traceability.read_text(encoding="utf-8")
    if "Current Implementation Traceability" in trace_text:
        raise SystemExit(
            "TRACEABILITY.md must describe its audited checkpoint as a baseline, not current HEAD"
        )
    if not trace_text.startswith("# NarrativeX V1.11 Baseline Implementation Traceability"):
        raise SystemExit("TRACEABILITY.md must use the V1.11 baseline traceability heading")

    checkpoints = {
        name: _sha(path, pattern)
        for name, (path, pattern) in CHECKPOINT_FILES.items()
    }
    if len(set(checkpoints.values())) != 1:
        raise SystemExit(
            "V1.11 implementation checkpoints disagree: "
            + ", ".join(f"{name}={value}" for name, value in checkpoints.items())
        )

    checkpoint = next(iter(checkpoints.values()))
    exists = _git("cat-file", "-e", f"{checkpoint}^{{commit}}")
    if exists.returncode != 0:
        raise SystemExit(f"Documented implementation checkpoint is not available in Git history: {checkpoint}")

    ancestor = _git("merge-base", "--is-ancestor", checkpoint, "HEAD")
    if ancestor.returncode != 0:
        raise SystemExit(
            f"Documented implementation checkpoint {checkpoint} is not an ancestor of checked-out HEAD"
        )

    changed = _git("diff", "--name-only", f"{checkpoint}..HEAD")
    if changed.returncode != 0:
        raise SystemExit(
            "Unable to inspect files changed after documentation checkpoint: "
            + changed.stderr.strip()
        )
    paths = [line.strip() for line in changed.stdout.splitlines() if line.strip()]
    runtime_changes = non_documentation_changes(paths)
    if runtime_changes:
        formatted = "\n- ".join(runtime_changes)
        raise SystemExit(
            "Runtime/application code changed after the documented implementation checkpoint. "
            "Audit current docs and advance all checkpoint references to the latest audited code commit. "
            "Unexpected post-checkpoint paths:\n- "
            + formatted
        )

    print(
        "Documentation checkpoint semantics passed: "
        f"baseline={checkpoint}, post-checkpoint changes are documentation/governance only"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
