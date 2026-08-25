#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@dataclass(slots=True)
class Step:
    name: str
    cwd: Path
    command: list[str]
    optional: bool = False


def command_exists(command: str, cwd: Path) -> bool:
    if command.startswith("./"):
        return (cwd / command[2:]).exists()
    return shutil.which(command) is not None


def run(step: Step) -> tuple[bool, float, str]:
    executable = step.command[0]
    if not command_exists(executable, step.cwd):
        return step.optional, 0.0, f"missing executable: {executable}"
    started = time.monotonic()
    print(f"\n==> {step.name}\n$ {' '.join(step.command)}", flush=True)
    completed = subprocess.run(step.command, cwd=step.cwd, check=False)
    elapsed = time.monotonic() - started
    return completed.returncode == 0, elapsed, f"exit {completed.returncode}"


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
        Step("Docs drift", ROOT, [python, "scripts/check-docs-drift.py"]),
        Step("Backend tests", backend, [mvnw, "test"]),
        Step("AI worker tests", worker, [python, "-m", "pytest"]),
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

    results: list[tuple[str, bool, float, str]] = []
    for step in steps:
        ok, elapsed, detail = run(step)
        results.append((step.name, ok, elapsed, detail))
        if not ok:
            break

    print("\nNarrativeX local quality gate")
    print("-" * 72)
    for name, ok, elapsed, detail in results:
        print(f"{'PASS' if ok else 'FAIL':4}  {elapsed:7.2f}s  {name} ({detail})")

    failed = [item for item in results if not item[1]]
    if failed:
        print("\nGate failed. Fix the first failing stage before merging.")
        return 1
    print("\nGate passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
