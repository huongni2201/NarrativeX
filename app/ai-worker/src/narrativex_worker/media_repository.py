"""Small provider-result/materialization port used by the image runner.

The concrete PostgreSQL implementation belongs to the worker repository layer. Keeping this port
provider-neutral makes crash/replay behavior testable without a paid provider.
"""

from dataclasses import dataclass
from typing import Protocol

from narrativex_worker.providers.image import ImageGenerationResult


@dataclass(frozen=True)
class DurableMediaResult:
    storage_key: str
    checksum: str
    mime_type: str
    width: int
    height: int
    item_key: str | None = None


class MediaGenerationRepository(Protocol):
    async def persist_provider_completion(
        self, item_key: str, request_fingerprint: str, result: DurableMediaResult
    ) -> None: ...

    async def materialize_asset(
        self,
        item_key: str,
        request_fingerprint: str,
        result: ImageGenerationResult,
        stored: DurableMediaResult,
    ) -> None: ...
