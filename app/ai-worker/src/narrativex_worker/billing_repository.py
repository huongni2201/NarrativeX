"""Durable provider billing persistence used before a GenerationJob becomes terminal."""

import json
from dataclasses import asdict

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.providers.ports import ProviderBilling
from narrativex_worker.repository import (
    DurableProviderOperation,
    ProviderOperationStateConflictError,
)


class ProviderBillingRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    async def persist(self, operation: DurableProviderOperation, billing: ProviderBilling) -> int:
        """Persist immutable billing evidence before quota settlement can run."""
        connection = await asyncpg.connect(self.database_url)
        try:
            async with connection.transaction():
                result = await connection.fetchrow(
                    """
                    UPDATE provider_operations
                       SET actual_cost = $3,
                           billing_currency = $4,
                           usage_json = $5::jsonb,
                           pricing_snapshot_json = $6::jsonb,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND row_version = $2
                       AND (
                           actual_cost IS NULL
                            OR (
                                actual_cost = $3
                                AND billing_currency = $4
                                AND usage_json = $5::jsonb
                                AND pricing_snapshot_json = $6::jsonb
                           )
                       )
                     RETURNING row_version
                     """,
                    operation.id,
                    operation.row_version,
                    billing.actual_cost,
                    billing.currency,
                    json.dumps(asdict(billing.usage), ensure_ascii=False),
                    json.dumps(asdict(billing.pricing), ensure_ascii=False, default=str),
                )
                if result is None:
                    raise ProviderOperationStateConflictError(operation.id, operation.row_version)
                return int(result["row_version"])
        finally:
            await connection.close()
