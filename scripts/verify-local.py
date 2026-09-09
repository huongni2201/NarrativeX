#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@dataclass(slots=True)
class Step:
    name: str
    cwd: Path
    command: list[str]
    optional: bool = False


class StepStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"


def resolve_executable(command: str, cwd: Path) -> str | None:
    """Resolve a command exactly as it will be passed to subprocess.

    Repository wrappers are resolved relative to the step working directory;
    ordinary tools fall back to PATH. Returning an absolute path also avoids
    Windows subprocess lookup treating a present mvnw.cmd as a PATH command.
    """
    candidate = Path(command)
    if candidate.is_absolute():
        return str(candidate.resolve()) if candidate.is_file() else None

    local_candidate = cwd / candidate
    if local_candidate.is_file():
        return str(local_candidate.resolve())

    return shutil.which(command)


def run(step: Step) -> tuple[StepStatus, float, str]:
    executable = resolve_executable(step.command[0], step.cwd)
    if executable is None:
        status = StepStatus.SKIP if step.optional else StepStatus.FAIL
        return status, 0.0, f"missing executable: {step.command[0]}"
    command = [executable, *step.command[1:]]
    started = time.monotonic()
    print(f"\n==> {step.name}\n$ {' '.join(command)}", flush=True)
    completed = subprocess.run(command, cwd=step.cwd, check=False)
    elapsed = time.monotonic() - started
    status = StepStatus.PASS if completed.returncode == 0 else StepStatus.FAIL
    return status, elapsed, f"exit {completed.returncode}"


def main() -> int:
    parser = argparse.ArgumentParser(description="NarrativeX local quality gate")
    parser.add_argument("--package-win", action="store_true", help="also build the Windows NSIS package")
    parser.add_argument("--with-db", action="store_true", help="run DB-destructive/integration checks only against an explicitly disposable database")
    args = parser.parse_args()

    backend = ROOT / "app" / "backend-service"
    worker = ROOT / "app" / "ai-worker"
    desktop = ROOT / "app" / "desktop"
    windows = os.name == "nt"

    python = sys.executable
    mvnw = "mvnw.cmd" if windows else "./mvnw"
    npm = "npm.cmd" if windows else "npm"

    steps = [
        Step("Secret scan", ROOT, [python, "scripts/check-secrets.py"]),
        Step("Docs drift", ROOT, [python, "scripts/check-docs-drift.py"]),
        Step("Compose config", ROOT, ["docker", "compose", "config", "--no-interpolate"], optional=True),
        Step("Backend verify", backend, [mvnw, "verify"]),
        Step("AI worker tests", worker, [python, "-m", "pytest"]),
        Step("AI worker lint", worker, [python, "-m", "ruff", "check", "src", "tests"]),
        Step("AI worker type-check", worker, [python, "-m", "mypy", "src"]),
        Step("Desktop tests/type-check/build", desktop, [npm, "run", "check"]),
    ]

    if args.with_db:
        if os.environ.get("NARRATIVEX_DISPOSABLE_DB") != "1":
            print("Refusing --with-db: set NARRATIVEX_DISPOSABLE_DB=1 only for a throw-away local/Testcontainers database.", file=sys.stderr)
            return 2
        db_name = os.environ.get("NARRATIVEX_DB_NAME", "")
        if db_name and not any(marker in db_name.lower() for marker in ("test", "tmp", "local")):
            print(f"Refusing destructive DB verification for suspicious database name: {db_name!r}", file=sys.stderr)
            return 2
        steps.append(Step("Backend disposable-DB verification", backend, [mvnw, "-Dspring.profiles.active=test", "verify"]))

    if args.package_win:
        steps.append(Step("Windows package", desktop, [npm, "run", "package:win"]))

    results: list[tuple[str, StepStatus, float, str]] = []
    for step in steps:
        status, elapsed, detail = run(step)
        results.append((step.name, status, elapsed, detail))
        if status is StepStatus.FAIL:
            break

    print("\nNarrativeX local quality gate")
    print("-" * 72)
    for name, status, elapsed, detail in results:
        print(f"{status.value:4}  {elapsed:7.2f}s  {name} ({detail})")

    failed = [item for item in results if item[1] is StepStatus.FAIL]
    if failed:
        print("\nGate failed. Fix the first failing stage before merging.")
        return 1
    print("\nGate passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
