"""Host-level GPU runtime residency management."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from narrativex_gpu_worker.application.errors import ResidencyTransitionError
from narrativex_gpu_worker.application.ports.residency import (
    RuntimeFamily,
    RuntimeRequirement,
)

LOGGER = logging.getLogger("narrativex.gpu_worker.residency")

LifecycleHook = Callable[[], Awaitable[None]]


class GpuResidencyManager:
    """Host-level residency manager ensuring single-GPU mutual exclusion.

    Enforces that only one heavy generative model family occupies GPU VRAM at
    any given time. When switching between runtime families, the existing family
    is unloaded, VRAM is verified reclaimed, and the incoming family is initialized.
    Transitions have strict timeouts and fail-closed semantics.
    """

    def __init__(
        self,
        transition_timeout_seconds: float = 30.0,
        unload_hooks: dict[RuntimeFamily, LifecycleHook] | None = None,
        load_hooks: dict[RuntimeFamily, LifecycleHook] | None = None,
        vram_reclamation_probe: Callable[[], Awaitable[bool]] | None = None,
    ) -> None:
        self._transition_timeout = transition_timeout_seconds
        self._unload_hooks = dict(unload_hooks or {})
        self._load_hooks = dict(load_hooks or {})
        self._vram_probe = vram_reclamation_probe
        self._current_family: RuntimeFamily = RuntimeFamily.NONE
        self._active_leases: int = 0
        self._lock = asyncio.Lock()
        self._condition = asyncio.Condition(self._lock)
        self._is_poisoned: bool = False

    @property
    def current_family(self) -> RuntimeFamily:
        return self._current_family

    @property
    def active_leases(self) -> int:
        return self._active_leases

    @property
    def is_poisoned(self) -> bool:
        return self._is_poisoned

    async def current_resident(self) -> RuntimeFamily:
        async with self._lock:
            return self._current_family

    @asynccontextmanager
    async def acquire(self, requirement: RuntimeRequirement) -> AsyncIterator[None]:
        """Acquire residency lease for the requirement, transitioning if necessary."""
        if requirement.family == RuntimeFamily.NONE:
            # CPU or fast non-VRAM tasks do not require GPU residency arbitration
            yield
            return

        async with self._condition:
            if self._is_poisoned:
                raise ResidencyTransitionError(
                    "GPU residency is in a poisoned state from a prior failed transition. "
                    "Call release_all to reset."
                )

            # Wait until any conflicting active leases have fully drained
            while self._active_leases > 0 and self._current_family != requirement.family:
                await self._condition.wait()

            # Also, if single execution is enforced, wait for existing leases to drain
            while self._active_leases > 0 and requirement.exclusive:
                await self._condition.wait()

            # Perform transition if target family differs from resident family
            if self._current_family != requirement.family:
                await self._execute_transition(requirement.family)

            self._active_leases += 1

        try:
            yield
        finally:
            async with self._condition:
                self._active_leases = max(0, self._active_leases - 1)
                self._condition.notify_all()

    async def transition_to(self, family: RuntimeFamily) -> None:
        """Explicitly transition to the specified runtime family."""
        async with self._condition:
            while self._active_leases > 0:
                await self._condition.wait()
            await self._execute_transition(family)

    async def _execute_transition(self, target_family: RuntimeFamily) -> None:
        """Internal transition with timeout and fail-closed guarantees. Must hold self._lock."""
        if self._current_family == target_family and not self._is_poisoned:
            return

        LOGGER.info(
            "Starting GPU residency transition: %s -> %s (timeout=%.1fs)",
            self._current_family,
            target_family,
            self._transition_timeout,
        )

        try:
            async with asyncio.timeout(self._transition_timeout):
                # 1. Unload current resident if active
                if self._current_family != RuntimeFamily.NONE:
                    unload_hook = self._unload_hooks.get(self._current_family)
                    if unload_hook is not None:
                        LOGGER.debug("Invoking unload hook for %s", self._current_family)
                        await unload_hook()

                    # 2. Verify VRAM reclamation if probe provided
                    if self._vram_probe is not None:
                        reclaimed = await self._vram_probe()
                        if not reclaimed:
                            raise ResidencyTransitionError(
                                f"VRAM was not reclaimed after unloading {self._current_family}"
                            )

                self._current_family = RuntimeFamily.NONE

                # 3. Load target family if not NONE
                if target_family != RuntimeFamily.NONE:
                    load_hook = self._load_hooks.get(target_family)
                    if load_hook is not None:
                        LOGGER.debug("Invoking load hook for %s", target_family)
                        await load_hook()

                self._current_family = target_family
                self._is_poisoned = False
                LOGGER.info("Successfully transitioned GPU residency to %s", target_family)

        except (TimeoutError, Exception) as exc:
            self._is_poisoned = True
            self._current_family = RuntimeFamily.NONE
            LOGGER.error(
                "FAIL-CLOSED: GPU residency transition to %s failed: %s",
                target_family,
                exc,
                exc_info=True,
            )
            if isinstance(exc, TimeoutError):
                raise ResidencyTransitionError(
                    f"Residency transition to {target_family} "
                    f"timed out after {self._transition_timeout}s"
                ) from exc
            if isinstance(exc, ResidencyTransitionError):
                raise
            raise ResidencyTransitionError(
                f"Residency transition to {target_family} failed: {exc}"
            ) from exc

    async def release_all(self) -> None:
        """Unload active runtime, reset poisoned status, and release GPU resources."""
        async with self._condition:
            while self._active_leases > 0:
                await self._condition.wait()

            try:
                async with asyncio.timeout(self._transition_timeout):
                    if self._current_family != RuntimeFamily.NONE:
                        unload_hook = self._unload_hooks.get(self._current_family)
                        if unload_hook is not None:
                            await unload_hook()
            finally:
                self._current_family = RuntimeFamily.NONE
                self._is_poisoned = False
                self._condition.notify_all()
                LOGGER.info("Released all GPU residency leases and reset state to NONE")


class NoOpRuntimeResidency:
    """Null residency adapter for testing or unconstrained GPU/CPU environments."""

    @asynccontextmanager
    async def acquire(self, requirement: RuntimeRequirement) -> AsyncIterator[None]:
        yield

    async def current_resident(self) -> RuntimeFamily:
        return RuntimeFamily.NONE

    async def transition_to(self, family: RuntimeFamily) -> None:
        pass

    async def release_all(self) -> None:
        pass


__all__ = [
    "GpuResidencyManager",
    "NoOpRuntimeResidency",
]
