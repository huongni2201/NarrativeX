"""Runtime process supervision and GPU VRAM reclamation for managed model processes."""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path

import httpx

from narrativex_gpu_worker.application.errors import ResidencyTransitionError
from narrativex_gpu_worker.application.ports.residency import RuntimeFamily

LOGGER = logging.getLogger("narrativex.gpu_worker.runtime.supervisor")


@dataclass(frozen=True, slots=True)
class GpuMemoryUsage:
    used_mb: int
    free_mb: int
    total_mb: int


class GpuVramProbe:
    """Probes GPU VRAM via nvidia-smi with fail-safe fallback for non-GPU / CI environments."""

    def __init__(
        self,
        nvidia_smi_path: str | None = None,
        max_idle_mb: int = 1500,
        enabled: bool = True,
    ) -> None:
        self._nvidia_smi = nvidia_smi_path or shutil.which("nvidia-smi")
        self._max_idle_mb = max_idle_mb
        self._enabled = enabled

    @property
    def is_available(self) -> bool:
        return self._enabled and self._nvidia_smi is not None

    async def query_vram(self) -> GpuMemoryUsage | None:
        if not self.is_available or not self._nvidia_smi:
            return None

        try:
            proc = await asyncio.create_subprocess_exec(
                self._nvidia_smi,
                "--query-gpu=memory.used,memory.free,memory.total",
                "--format=csv,noheader,nounits",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                LOGGER.warning(
                    "nvidia-smi exited with code %s: %s",
                    proc.returncode,
                    stderr.decode().strip(),
                )
                return None

            lines = stdout.decode().strip().splitlines()
            if not lines:
                return None

            # First GPU metrics
            parts = [p.strip() for p in lines[0].split(",")]
            if len(parts) >= 3:
                return GpuMemoryUsage(
                    used_mb=int(parts[0]),
                    free_mb=int(parts[1]),
                    total_mb=int(parts[2]),
                )
            return None
        except Exception as exc:
            LOGGER.warning("Failed to query nvidia-smi: %s", exc)
            return None

    async def check_reclaimed(self) -> bool:
        """Returns True if VRAM usage is at or below max_idle_mb, or if GPU probing is inactive."""
        if not self.is_available:
            return True

        usage = await self.query_vram()
        if usage is None:
            # Non-NVIDIA or probing failed: assume reclaimed so CI / dev runs proceed
            return True

        if usage.used_mb > self._max_idle_mb:
            LOGGER.warning(
                "GPU VRAM not reclaimed: %d MB used (threshold %d MB)",
                usage.used_mb,
                self._max_idle_mb,
            )
            return False

        LOGGER.info(
            "GPU VRAM reclaimed: %d MB used <= %d MB threshold",
            usage.used_mb,
            self._max_idle_mb,
        )
        return True


@dataclass(frozen=True, slots=True)
class ProcessSpec:
    family: RuntimeFamily
    command: tuple[str, ...]
    cwd: Path | None = None
    env: tuple[tuple[str, str], ...] | None = None
    health_url: str | None = None
    startup_timeout_seconds: float = 30.0
    shutdown_timeout_seconds: float = 10.0


class RuntimeProcessSupervisor:
    """Manages lifecycle of sub-runtime processes with health probes and VRAM checks."""

    def __init__(
        self,
        vram_probe: GpuVramProbe | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._vram_probe = vram_probe or GpuVramProbe()
        self._http_client = http_client
        self._specs: dict[RuntimeFamily, ProcessSpec] = {}
        self._processes: dict[RuntimeFamily, asyncio.subprocess.Process] = {}

    def register_runtime(self, spec: ProcessSpec) -> None:
        self._specs[spec.family] = spec

    def is_running(self, family: RuntimeFamily) -> bool:
        proc = self._processes.get(family)
        return proc is not None and proc.returncode is None

    async def start(self, family: RuntimeFamily) -> None:
        if family not in self._specs:
            # If no process registered for this family, no external process to start
            return

        spec = self._specs[family]
        if self.is_running(family):
            LOGGER.debug("Process for %s is already running", family)
            return

        LOGGER.info("Starting managed process for %s: %s", family, spec.command)
        merged_env = os.environ.copy()
        if spec.env:
            merged_env.update(dict(spec.env))

        proc = await asyncio.create_subprocess_exec(
            *spec.command,
            cwd=str(spec.cwd) if spec.cwd else None,
            env=merged_env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self._processes[family] = proc

        # Wait for readiness
        try:
            async with asyncio.timeout(spec.startup_timeout_seconds):
                while True:
                    try:
                        await asyncio.wait_for(proc.wait(), timeout=0.02)
                    except TimeoutError:
                        pass

                    if proc.returncode is not None:
                        raise ResidencyTransitionError(
                            f"Process for {family} exited prematurely with code {proc.returncode}"
                        )

                    if spec.health_url:
                        if await self._check_health(spec.health_url):
                            break
                    else:
                        # Process alive without health URL is considered started
                        break
                    await asyncio.sleep(0.1)
        except TimeoutError as exc:
            await self.stop(family)
            raise ResidencyTransitionError(
                f"Timed out waiting for {family} process to become ready "
                f"after {spec.startup_timeout_seconds}s"
            ) from exc

    async def stop(self, family: RuntimeFamily) -> None:
        proc = self._processes.pop(family, None)
        if proc is None or proc.returncode is not None:
            return

        spec = self._specs.get(family)
        timeout = spec.shutdown_timeout_seconds if spec else 10.0

        LOGGER.info("Stopping managed process for %s (PID=%s)", family, proc.pid)
        try:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=timeout)
            except TimeoutError:
                LOGGER.warning(
                    "Process %s (PID=%s) did not exit within %ss, killing",
                    family,
                    proc.pid,
                    timeout,
                )
                proc.kill()
                await proc.wait()
        except ProcessLookupError:
            pass

    async def stop_all(self) -> None:
        for family in list(self._processes.keys()):
            await self.stop(family)

    async def _check_health(self, url: str) -> bool:
        try:
            client = self._http_client or httpx.AsyncClient(timeout=0.5)
            close_client = self._http_client is None
            try:
                res = await client.get(url)
                return res.status_code in {200, 204}
            finally:
                if close_client:
                    await client.aclose()
        except Exception:
            return False

    def create_load_hook(self, family: RuntimeFamily) -> Callable[[], Awaitable[None]]:
        async def _hook() -> None:
            await self.start(family)

        return _hook

    def create_unload_hook(self, family: RuntimeFamily) -> Callable[[], Awaitable[None]]:
        async def _hook() -> None:
            await self.stop(family)

        return _hook

    @property
    def vram_probe(self) -> GpuVramProbe:
        return self._vram_probe


__all__ = [
    "GpuMemoryUsage",
    "GpuVramProbe",
    "ProcessSpec",
    "RuntimeProcessSupervisor",
]
