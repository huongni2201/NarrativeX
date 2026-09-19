from __future__ import annotations

from typing import Protocol


class ComputeEventPublisherPort(Protocol):
    """Port for delivering compute lifecycle events to external subscribers."""

    async def publish(self, payload_json: str) -> bool: ...

    async def close(self) -> None: ...
