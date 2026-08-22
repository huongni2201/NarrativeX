from dataclasses import dataclass
from decimal import ROUND_UP, Decimal


@dataclass(frozen=True)
class TtsPricingSnapshot:
    catalog_version: str
    voice_tier: str
    sku: str
    usd_per_million_characters: Decimal

    def actual_cost(self, character_count: int) -> Decimal:
        if character_count < 0:
            raise ValueError("character_count must not be negative")
        value = Decimal(character_count) * self.usd_per_million_characters / Decimal(1_000_000)
        return value.quantize(Decimal("0.000000001"), rounding=ROUND_UP)


class GoogleTtsPricingCatalog:
    def __init__(self, catalog_version: str) -> None:
        self.catalog_version = catalog_version

    def resolve(self, voice_id: str) -> TtsPricingSnapshot:
        if "Chirp3-HD" in voice_id:
            return self._snapshot("CHIRP3_HD", "F977-2280-6F1B", "30")
        if "Studio" in voice_id:
            return self._snapshot("STUDIO", "84AB-48C0-F9C3", "160")
        if "Neural2" in voice_id or "Polyglot" in voice_id:
            return self._snapshot("NEURAL2_POLYGLOT", "FEBD-04B6-769B", "16")
        if "Wavenet" in voice_id or "Standard" in voice_id:
            return self._snapshot("STANDARD_WAVENET", "9D01-5995-B545", "4")
        raise ValueError(f"Unsupported Google TTS voice tier for {voice_id!r}")

    def _snapshot(self, tier: str, sku: str, rate: str) -> TtsPricingSnapshot:
        return TtsPricingSnapshot(self.catalog_version, tier, sku, Decimal(rate))


class VieneuTtsPricingCatalog:
    """Zero external-provider cost snapshot for on-device VieNeu execution."""

    def __init__(self, catalog_version: str) -> None:
        self.catalog_version = catalog_version

    def resolve(self, voice_id: str) -> TtsPricingSnapshot:
        del voice_id
        return TtsPricingSnapshot(
            catalog_version=self.catalog_version,
            voice_tier="VIENEU_LOCAL",
            sku="VIENEU-LOCAL-EXECUTION",
            usd_per_million_characters=Decimal("0"),
        )
