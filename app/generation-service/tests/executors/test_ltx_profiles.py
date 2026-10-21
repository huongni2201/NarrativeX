"""Operator-selected LTX profiles; mocked, never a GPU readiness claim."""

from unittest.mock import AsyncMock

import pytest

from narrativex_gpu_worker.adapters.executors.ltx import executor as module
from narrativex_gpu_worker.adapters.executors.ltx.executor import LtxVideoExecutor
from narrativex_gpu_worker.adapters.executors.ltx.profiles import (
    DEFAULT_PROFILE_ID,
    available_profiles,
    resolve_profile,
)
from narrativex_gpu_worker.bootstrap import split_command


def test_blank_profile_selects_the_pinned_default():
    profile = resolve_profile("  ")
    assert profile.profile_id == DEFAULT_PROFILE_ID
    assert profile.graph_path.is_file()
    assert DEFAULT_PROFILE_ID in available_profiles()


def test_unknown_profile_fails_closed_and_lists_choices():
    with pytest.raises(ValueError, match=DEFAULT_PROFILE_ID):
        resolve_profile("ltx-unknown")


def test_executor_advertises_the_selected_profile():
    profile = resolve_profile()
    executor = LtxVideoExecutor(AsyncMock(), AsyncMock(), profile=profile)
    assert executor.models[0].model == profile.model_id
    assert executor.workflow_profiles[0]["profile_id"] == profile.profile_id
    assert executor.runtime_requirement.vram_budget_mb == profile.vram_budget_mb


def test_vram_budget_can_be_overridden():
    executor = LtxVideoExecutor(AsyncMock(), AsyncMock(), vram_budget_mb=24576)
    assert executor.runtime_requirement.vram_budget_mb == 24576


async def test_gpu_smaller_than_profile_minimum_stays_unready(monkeypatch, tmp_path):
    verification = []
    monkeypatch.setattr(
        module, "verify_runtime_files", lambda path, _profile=None: verification.append(path)
    )
    client = AsyncMock()
    executor = LtxVideoExecutor(
        client,
        AsyncMock(),
        runtime_directory=tmp_path,
        gpu_total_vram_mb=AsyncMock(return_value=24564),
    )
    await executor.preflight()
    assert not executor.ready
    assert "24564 MB VRAM" in executor.readiness_error
    assert verification == []
    client.object_info.assert_not_awaited()


async def test_32gb_card_reporting_below_32768_passes_vram_gate(monkeypatch, tmp_path):
    verification = []
    monkeypatch.setattr(
        module, "verify_runtime_files", lambda path, _profile=None: verification.append(path)
    )
    client = AsyncMock()
    client.object_info.side_effect = ValueError("schema not mocked")
    executor = LtxVideoExecutor(
        client,
        AsyncMock(),
        runtime_directory=tmp_path,
        gpu_total_vram_mb=AsyncMock(return_value=32607),
    )
    await executor.preflight()
    assert verification == [tmp_path]
    assert "VRAM" not in executor.readiness_error


def test_windows_command_keeps_backslashes_and_strips_quotes():
    command = (
        r'"C:\Program Files\Python\python.exe" '
        r"C:\NarrativeXRuntime\ComfyUI\main.py --port 8188"
    )
    assert split_command(command, windows=True) == (
        r"C:\Program Files\Python\python.exe",
        r"C:\NarrativeXRuntime\ComfyUI\main.py",
        "--port",
        "8188",
    )


def test_posix_command_split_is_unchanged():
    assert split_command("python3 '/opt/comfy ui/main.py' --lowvram", windows=False) == (
        "python3",
        "/opt/comfy ui/main.py",
        "--lowvram",
    )
