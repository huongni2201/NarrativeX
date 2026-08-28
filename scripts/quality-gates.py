"""Run NarrativeX's local CI and quality gates without a hosted CI provider.

The command is intentionally tool-agnostic: it runs the same checks locally that should
be used before merging, and never treats a failed compile, test, lint, type or docs check
as non-blocking.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUALITY_GATE_TMP = ROOT / ".quality-gate-tmp"


@dataclass(frozen=True)
class Gate:
    name: str
    command: tuple[str, ...]
    cwd: Path = ROOT
    required_tools: tuple[str, ...] = ()


def python_gate(name: str, *args: str, cwd: Path = ROOT) -> Gate:
    return Gate(name, (sys.executable, *args), cwd)


def gates(profile: str, skip_install: bool) -> list[Gate]:
    maven = str(ROOT / "app/backend-service/mvnw.cmd")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    result = [
        python_gate(
            "docs-governance-tests",
            "-m",
            "unittest",
            "scripts/test_check_docs_drift.py",
            "scripts/test_check_docs_checkpoint.py",
        ),
        python_gate("docs-drift", "scripts/check-docs-drift.py"),
        python_gate("docs-checkpoint", "scripts/check-docs-checkpoint.py"),
        python_gate("secret-scan", "scripts/check-secrets.py"),
        Gate("backend-test", (maven, "-B", "test"), ROOT / "app/backend-service"),
        Gate(
            "backend-spotless",
            (maven, "-B", "spotless:check"),
            ROOT / "app/backend-service",
        ),
        python_gate(
            "worker-pytest",
            "-m",
            "pytest",
            "--basetemp",
            str(QUALITY_GATE_TMP),
            cwd=ROOT / "app/ai-worker",
        ),
        python_gate("worker-ruff", "-m", "ruff", "check", ".", cwd=ROOT / "app/ai-worker"),
        python_gate("worker-mypy", "-m", "mypy", "src", cwd=ROOT / "app/ai-worker"),
    ]

    if not skip_install:
        result.insert(
            4,
            Gate("desktop-install-lockfile", (npm, "ci"), ROOT / "app/desktop"),
        )
    result.extend(
        [
            Gate("desktop-test", (npm, "test"), ROOT / "app/desktop"),
            Gate("desktop-typecheck", (npm, "run", "type-check"), ROOT / "app/desktop"),
            Gate("desktop-build", (npm, "run", "build"), ROOT / "app/desktop"),
        ]
    )

    if profile == "all":
        result.extend(
            [
                Gate(
                    "backend-postgres",
                    (maven, "-B", "clean", "verify"),
                    ROOT / "app/backend-service",
                    ("docker",),
                ),
                Gate(
                    "backend-image",
                    ("docker", "build", "--tag", "narrativex-backend:quality-gate", "."),
                    ROOT / "app/backend-service",
                    ("docker",),
                ),
            ]
        )
    return result


def run_gate(gate: Gate) -> int:
    missing = [tool for tool in gate.required_tools if shutil.which(tool) is None]
    if missing:
        print(f"[{gate.name}] missing required tool(s): {', '.join(missing)}", file=sys.stderr)
        return 1

    env = os.environ.copy()
    env.setdefault("PYTHONUTF8", "1")
    print(f"\n=== {gate.name} ===")
    completed = subprocess.run(gate.command, cwd=gate.cwd, env=env, check=False)
    if completed.returncode != 0:
        print(f"[{gate.name}] FAILED ({completed.returncode})", file=sys.stderr)
        return completed.returncode
    print(f"[{gate.name}] passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--profile",
        choices=("fast", "all"),
        default="fast",
        help="fast runs PR-sized local gates; all also runs Docker/PostgreSQL gates",
    )
    parser.add_argument(
        "--skip-install",
        action="store_true",
        help="reuse the current desktop node_modules instead of running npm ci",
    )
    args = parser.parse_args()

    for gate in gates(args.profile, args.skip_install):
        result = run_gate(gate)
        if result != 0:
            return result
    print("\nAll requested NarrativeX quality gates passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
