from decimal import Decimal

import pytest

from narrativex_worker.narration.pricing import GoogleTtsPricingCatalog


def test_google_tts_pricing_snapshot_is_versioned_and_deterministic() -> None:
    catalog = GoogleTtsPricingCatalog("google-tts-2026-08-20")
    chirp = catalog.resolve("vi-VN-Chirp3-HD-Achernar")
    neural = catalog.resolve("en-US-Neural2-A")

    assert chirp.catalog_version == "google-tts-2026-08-20"
    assert chirp.usd_per_million_characters == Decimal("30")
    assert chirp.actual_cost(2_000) == Decimal("0.060000000")
    assert neural.usd_per_million_characters == Decimal("16")


def test_unknown_google_voice_tier_is_rejected_instead_of_mispriced() -> None:
    with pytest.raises(ValueError, match="Unsupported Google TTS voice tier"):
        GoogleTtsPricingCatalog("v1").resolve("unknown-voice")
