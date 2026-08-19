"""Durable provider billing persistence used before a GenerationJob becomes terminal."""

import json
from dataclasses import asdict

import asyncpg  # type: ignore[import-untyped]

from narrativex_worker.providers.ports import ProviderBilling


class ProviderBillingRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    async def persist(self, provider_operation_id: int, billing: ProviderBilling) -> None:
        """Persist immutable billing evidence before quota settlement can run."""
        connection = await asyncpg.connect(self.database_url)
        try:
            async with connection.transaction():
                result = await connection.execute(
                    """
                    UPDATE provider_operations
                       SET actual_cost = $2,
                           billing_currency = $3,
                           usage_json = $4::jsonb,
                           pricing_snapshot_json = $5::jsonb,
                           updated_at = CURRENT_TIMESTAMP,
                           row_version = row_version + 1
                     WHERE id = $1
                       AND (
                           actual_cost IS NULL
                           OR (
                               actual_cost = $2
                               AND billing_currency = $3
                               AND usage_json = $4::jsonb
                               AND pricing_snapshot_json = $5::jsonb
                           )
                       )
                    """,
                    provider_operation_id,
                    billing.actual_cost,
                    billing.currency,
                    json.dumps(asdict(billing.usage), ensure_ascii=False),
                    json.dumps(asdict(billing.pricing), ensure_ascii=False, default=str),
                )
                if result != "UPDATE 1":
                    raise RuntimeError(
                        f"Provider billing for operation {provider_operation_id} conflicts with "
                        "already-persisted billing evidence"
                    )
        finally:
            await connection.close()
