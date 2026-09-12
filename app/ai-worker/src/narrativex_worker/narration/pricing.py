from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class TtsPricingSnapshot:
    """Compatibility snapshot retained while monetary billing fields are retired."""

    catalog_version: str
    voice_tier: str
    sku: str
    usd_per_million_characters: Decimal = Decimal("0")

    def actual_cost(self, character_count: int) -> Decimal:
        if character_count < 0:
            raise ValueError("character_count must not be negative")
        return Decimal("0.000000000")


class GoogleTtsPricingCatalog:
    """Compatibility resolver with all monetary pricing disabled."""

    def __init__(self, catalog_version: str) -> None:
        self.catalog_version = catalog_version

    def resolve(self, voice_id: str) -> TtsPricingSnapshot:
        return TtsPricingSnapshot(
            catalog_version="billing-disabled",
            voice_tier="USAGE_ONLY",
            sku=voice_id,
        )


class VieneuTtsPricingCatalog:
    """Compatibility resolver for on-device VieNeu execution."""

    def __init__(self, catalog_version: str) -> None:
        self.catalog_version = catalog_version

    def resolve(self, voice_id: str) -> TtsPricingSnapshot:
        return TtsPricingSnapshot(
            catalog_version="billing-disabled",
            voice_tier="VIENEU_LOCAL",
            sku=voice_id,
        )
