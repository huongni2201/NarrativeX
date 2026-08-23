from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Protocol

from narrativex_worker.narration.models import NarrationSegment, SynthesizedSegment


class TtsProviderRejectedError(RuntimeError):
    """Provider rejected the request before producing billable audio."""


class TtsProviderUnknownError(RuntimeError):
    """Provider outcome may have been accepted; never blind-resubmit."""


class TtsExecutionSemantics(StrEnum):
    """How the worker must persist/retry a provider submission."""

    LOCAL_RETRYABLE = "local_retryable"
    EXTERNAL_DURABLE = "external_durable"


@dataclass(frozen=True)
class TtsProviderCapabilities:
    supports_batch: bool
    supports_speaking_rate: bool
    supports_voice_reference: bool
    execution_semantics: TtsExecutionSemantics


@dataclass(frozen=True)
class TtsRequest:
    request_id: str
    segment: NarrationSegment
    voice_id: str
    language: str
    speaking_rate: float
    reference_audio_path: Path | None = None
    sample_rate_hz: int = 48000
    channels: int = 1


class TtsProvider(Protocol):
    @property
    def provider_key(self) -> str: ...

    @property
    def capabilities(self) -> TtsProviderCapabilities: ...

    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment: ...

    async def synthesize_batch(self, requests: list[TtsRequest]) -> list[SynthesizedSegment]: ...

    async def enroll_reference_voice(self, request_id: str, reference_audio_path: Path) -> str: ...

    async def release_reference_voice(self, voice_id: str) -> None: ...


class FakeTtsProvider:
    """Deterministic 16-bit PCM provider for unit and acceptance tests."""

    @property
    def provider_key(self) -> str:
        return "fake-tts"

    @property
    def capabilities(self) -> TtsProviderCapabilities:
        return TtsProviderCapabilities(
            supports_batch=True,
            supports_speaking_rate=True,
            supports_voice_reference=False,
            execution_semantics=TtsExecutionSemantics.LOCAL_RETRYABLE,
        )

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

    async def synthesize_batch(self, requests: list[TtsRequest]) -> list[SynthesizedSegment]:
        return [await self.synthesize(request) for request in requests]

    async def enroll_reference_voice(self, request_id: str, reference_audio_path: Path) -> str:
        del request_id, reference_audio_path
        raise TtsProviderRejectedError("Fake TTS does not support uploaded voice references")

    async def release_reference_voice(self, voice_id: str) -> None:
        del voice_id
