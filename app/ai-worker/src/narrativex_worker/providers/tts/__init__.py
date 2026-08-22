"""Production text-to-speech adapters."""

from narrativex_worker.providers.tts.google import GoogleCloudTtsProvider
from narrativex_worker.providers.tts.vieneu import VieneuTtsProvider

__all__ = ["GoogleCloudTtsProvider", "VieneuTtsProvider"]
