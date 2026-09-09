from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[1] / "verify-local.py"
SPEC = importlib.util.spec_from_file_location("verify_local", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
verify_local = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = verify_local
SPEC.loader.exec_module(verify_local)


def test_resolve_local_wrapper_from_step_cwd(tmp_path: Path) -> None:
    wrapper = tmp_path / "mvnw.cmd"
    wrapper.write_text("@echo off\n", encoding="utf-8")

    assert verify_local.resolve_executable("mvnw.cmd", tmp_path) == str(wrapper.resolve())
    assert verify_local.resolve_executable("./mvnw.cmd", tmp_path) == str(wrapper.resolve())


def test_resolve_absolute_path_with_spaces(tmp_path: Path) -> None:
    wrapper = tmp_path / "directory with spaces" / "mvnw.cmd"
    wrapper.parent.mkdir()
    wrapper.write_text("@echo off\n", encoding="utf-8")

    assert verify_local.resolve_executable(str(wrapper), tmp_path) == str(wrapper.resolve())


def test_resolve_missing_command_uses_path_fallback(tmp_path: Path) -> None:
    with patch.object(verify_local.shutil, "which", return_value="/tools/npm") as which:
        assert verify_local.resolve_executable("npm", tmp_path) == "/tools/npm"
        which.assert_called_once_with("npm")


def test_missing_optional_tool_is_skipped(tmp_path: Path) -> None:
    with patch.object(verify_local, "resolve_executable", return_value=None):
        status, elapsed, detail = verify_local.run(
            verify_local.Step("Compose config", tmp_path, ["docker"], optional=True)
        )

    assert status is verify_local.StepStatus.SKIP
    assert elapsed == 0.0
    assert detail == "missing executable: docker"


def test_nonzero_exit_is_failed_and_propagated(tmp_path: Path) -> None:
    completed = subprocess.CompletedProcess(["tool"], 7)
    with (
        patch.object(verify_local, "resolve_executable", return_value="/tools/tool"),
        patch.object(verify_local.subprocess, "run", return_value=completed) as run,
    ):
        status, _elapsed, detail = verify_local.run(
            verify_local.Step("Failing command", tmp_path, ["tool", "verify"])
        )

    assert status is verify_local.StepStatus.FAIL
    assert detail == "exit 7"
    run.assert_called_once_with(["/tools/tool", "verify"], cwd=tmp_path, check=False)
