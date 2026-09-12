from decimal import Decimal

from narrativex_worker.narration.pricing import GoogleTtsPricingCatalog


def test_google_tts_catalog_keeps_compatibility_without_monetary_pricing() -> None:
    catalog = GoogleTtsPricingCatalog("google-tts-2026-08-20")
    chirp = catalog.resolve("vi-VN-Chirp3-HD-Achernar")
    unknown = catalog.resolve("unknown-voice")

    assert chirp.catalog_version == "billing-disabled"
    assert chirp.usd_per_million_characters == Decimal("0")
    assert chirp.actual_cost(2_000) == Decimal("0.000000000")
    assert unknown.catalog_version == "billing-disabled"
    assert unknown.actual_cost(2_000) == Decimal("0.000000000")
