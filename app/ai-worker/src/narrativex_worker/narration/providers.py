from dataclasses import dataclass
from typing import Protocol

from narrativex_worker.narration.models import NarrationSegment, SynthesizedSegment


@dataclass(frozen=True)
class TtsRequest:
    request_id: str
    segment: NarrationSegment
    voice_id: str
    language: str
    speaking_rate: float
    sample_rate_hz: int = 48000
    channels: int = 1


class TtsProvider(Protocol):
    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment: ...


class FakeTtsProvider:
    """Deterministic 16-bit PCM provider for unit and acceptance tests."""

    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment:
        text_units = request.segment.text_end - request.segment.text_start
        duration_ms = max(120, min(6000, text_units * 45))
        samples = round(request.sample_rate_hz * duration_ms / 1000)
        pcm_bytes = b"\x00\x00" * samples * request.channels
        return SynthesizedSegment(
            segment=request.segment,
            pcm_bytes=pcm_bytes,
            sample_rate_hz=request.sample_rate_hz,
            channels=request.channels,
        )
