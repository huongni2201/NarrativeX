"""Port defining host-level GPU model residency and mutual exclusion."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol


class RuntimeFamily(StrEnum):
    NONE = "NONE"
    VIENEU = "VIENEU"
    COMFYUI_IMAGE = "COMFYUI_IMAGE"
    WHISPERX = "WHISPERX"
    COMFYUI_VIDEO = "COMFYUI_VIDEO"


@dataclass(frozen=True, slots=True)
class RuntimeRequirement:
    """Resource requirement for one executor invocation."""

    family: RuntimeFamily
    vram_budget_mb: int = 0
    exclusive: bool = True


class RuntimeResidencyPort(Protocol):
    """Host-level manager ensuring exclusive residency of heavy generative models."""

    def acquire(self, requirement: RuntimeRequirement) -> AbstractAsyncContextManager[None]:
        """Acquire residency lease for the given requirement, transitioning if necessary."""
        ...

    async def current_resident(self) -> RuntimeFamily:
        """Return the currently resident runtime family."""
        ...

    async def transition_to(self, family: RuntimeFamily) -> None:
        """Explicitly transition to the specified runtime family."""
        ...

    async def release_all(self) -> None:
        """Unload active runtime and release GPU VRAM."""
        ...


class NullRuntimeResidency:
    """Null residency adapter for unconstrained environments or default fallback."""

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
    "NullRuntimeResidency",
    "RuntimeFamily",
    "RuntimeRequirement",
    "RuntimeResidencyPort",
]
