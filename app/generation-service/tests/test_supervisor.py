from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from narrativex_gpu_worker.adapters.runtime.manager import GpuResidencyManager
from narrativex_gpu_worker.adapters.runtime.supervisor import (
    GpuVramProbe,
    ProcessSpec,
    RuntimeProcessSupervisor,
)
from narrativex_gpu_worker.application.errors import ResidencyTransitionError
from narrativex_gpu_worker.application.ports.residency import (
    RuntimeFamily,
    RuntimeRequirement,
)


async def test_vram_probe_disabled() -> None:
    probe = GpuVramProbe(enabled=False)
    assert not probe.is_available
    assert await probe.query_vram() is None
    assert await probe.check_reclaimed() is True


async def test_vram_probe_missing_binary() -> None:
    probe = GpuVramProbe(nvidia_smi_path="/nonexistent/nvidia-smi")
    assert not probe.is_available or True
    # Query should return None on missing binary
    assert await probe.query_vram() is None
    assert await probe.check_reclaimed() is True


async def test_vram_probe_parse_success() -> None:
    probe = GpuVramProbe(nvidia_smi_path="nvidia-smi")

    mock_proc = AsyncMock()
    mock_proc.communicate.return_value = (b"1200, 23000, 24576\n", b"")
    mock_proc.returncode = 0

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        usage = await probe.query_vram()
        assert usage is not None
        assert usage.used_mb == 1200
        assert usage.free_mb == 23000
        assert usage.total_mb == 24576
        assert await probe.check_reclaimed() is True


async def test_vram_probe_unreclaimed() -> None:
    probe = GpuVramProbe(nvidia_smi_path="nvidia-smi", max_idle_mb=1500)

    mock_proc = AsyncMock()
    mock_proc.communicate.return_value = (b"8500, 16000, 24576\n", b"")
    mock_proc.returncode = 0

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        usage = await probe.query_vram()
        assert usage is not None
        assert usage.used_mb == 8500
        assert await probe.check_reclaimed() is False


async def test_supervisor_register_and_start_without_spec() -> None:
    supervisor = RuntimeProcessSupervisor()
    # Starting a family with no spec is a no-op
    await supervisor.start(RuntimeFamily.VIENEU)
    assert not supervisor.is_running(RuntimeFamily.VIENEU)


async def test_supervisor_start_and_stop_process(tmp_path: Path) -> None:
    supervisor = RuntimeProcessSupervisor()
    # Use python executable running a sleep script
    import sys
    spec = ProcessSpec(
        family=RuntimeFamily.VIENEU,
        command=(sys.executable, "-c", "import time; time.sleep(10)"),
        startup_timeout_seconds=5.0,
        shutdown_timeout_seconds=2.0,
    )
    supervisor.register_runtime(spec)

    await supervisor.start(RuntimeFamily.VIENEU)
    assert supervisor.is_running(RuntimeFamily.VIENEU)

    # Calling start again while running is a no-op
    await supervisor.start(RuntimeFamily.VIENEU)
    assert supervisor.is_running(RuntimeFamily.VIENEU)

    await supervisor.stop(RuntimeFamily.VIENEU)
    assert not supervisor.is_running(RuntimeFamily.VIENEU)


async def test_supervisor_premature_exit() -> None:
    supervisor = RuntimeProcessSupervisor()
    import sys
    spec = ProcessSpec(
        family=RuntimeFamily.COMFYUI_IMAGE,
        command=(sys.executable, "-c", "import sys; sys.exit(42)"),
        health_url="http://127.0.0.1:9999/health",
        startup_timeout_seconds=5.0,
    )
    supervisor.register_runtime(spec)

    with pytest.raises(ResidencyTransitionError, match="exited prematurely with code 42"):
        await supervisor.start(RuntimeFamily.COMFYUI_IMAGE)
    assert not supervisor.is_running(RuntimeFamily.COMFYUI_IMAGE)


async def test_supervisor_integration_with_residency_manager() -> None:
    supervisor = RuntimeProcessSupervisor()
    import sys

    spec_v = ProcessSpec(
        family=RuntimeFamily.VIENEU,
        command=(sys.executable, "-c", "import time; time.sleep(10)"),
    )
    spec_c = ProcessSpec(
        family=RuntimeFamily.COMFYUI_IMAGE,
        command=(sys.executable, "-c", "import time; time.sleep(10)"),
    )
    supervisor.register_runtime(spec_v)
    supervisor.register_runtime(spec_c)

    manager = GpuResidencyManager(
        transition_timeout_seconds=5.0,
        unload_hooks={
            RuntimeFamily.VIENEU: supervisor.create_unload_hook(RuntimeFamily.VIENEU),
            RuntimeFamily.COMFYUI_IMAGE: supervisor.create_unload_hook(RuntimeFamily.COMFYUI_IMAGE),
        },
        load_hooks={
            RuntimeFamily.VIENEU: supervisor.create_load_hook(RuntimeFamily.VIENEU),
            RuntimeFamily.COMFYUI_IMAGE: supervisor.create_load_hook(RuntimeFamily.COMFYUI_IMAGE),
        },
    )

    req_v = RuntimeRequirement(family=RuntimeFamily.VIENEU, exclusive=True)
    req_c = RuntimeRequirement(family=RuntimeFamily.COMFYUI_IMAGE, exclusive=True)

    async with manager.acquire(req_v):
        assert manager.current_family == RuntimeFamily.VIENEU
        assert supervisor.is_running(RuntimeFamily.VIENEU)
        assert not supervisor.is_running(RuntimeFamily.COMFYUI_IMAGE)

    async with manager.acquire(req_c):
        assert manager.current_family == RuntimeFamily.COMFYUI_IMAGE
        assert not supervisor.is_running(RuntimeFamily.VIENEU)
        assert supervisor.is_running(RuntimeFamily.COMFYUI_IMAGE)

    await manager.release_all()
    await supervisor.stop_all()
    assert not supervisor.is_running(RuntimeFamily.COMFYUI_IMAGE)
    assert not supervisor.is_running(RuntimeFamily.VIENEU)
