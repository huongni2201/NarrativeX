"""Compatibility shim after monetary billing was removed from worker execution."""

from narrativex_worker.providers.ports import ProviderBilling
from narrativex_worker.repository import DurableProviderOperation


class ProviderBillingRepository:
    """Keep the old call boundary temporarily without persisting cost or pricing metadata."""

    def __init__(self, database_url: str) -> None:
        del database_url

    async def persist(self, operation: DurableProviderOperation, billing: ProviderBilling) -> int:
        del billing
        return operation.row_version
