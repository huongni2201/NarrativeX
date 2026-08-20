import hashlib
from dataclasses import dataclass

from narrativex_worker.narration.alignment import NarrationAlignmentValidator, build_alignment
from narrativex_worker.narration.models import AlignmentSpan
from narrativex_worker.narration.providers import TtsProvider, TtsRequest
from narrativex_worker.narration.segmenter import NarrationSegmenter, utf16_length


@dataclass(frozen=True)
class NarrationResult:
    pcm_bytes: bytes
    sample_rate_hz: int
    channels: int
    duration_ms: int
    checksum: str
    alignment: list[AlignmentSpan]


class FullChapterNarrationService:
    def __init__(
        self,
        provider: TtsProvider,
        *,
        segmenter: NarrationSegmenter | None = None,
        validator: NarrationAlignmentValidator | None = None,
    ) -> None:
        self.provider = provider
        self.segmenter = segmenter or NarrationSegmenter()
        self.validator = validator or NarrationAlignmentValidator()

    async def synthesize(
        self,
        *,
        narration_request_id: str,
        source_text: str,
        voice_id: str,
        language: str,
        speaking_rate: float = 1.0,
    ) -> NarrationResult:
        segments = self.segmenter.segment(source_text)
        synthesized = []
        for segment in segments:
            synthesized.append(
                await self.provider.synthesize(
                    TtsRequest(
                        request_id=f"{narration_request_id}:segment:{segment.index:04d}",
                        segment=segment,
                        voice_id=voice_id,
                        language=language,
                        speaking_rate=speaking_rate,
                    )
                )
            )

        pcm = b"".join(item.pcm_bytes for item in synthesized)
        alignment = build_alignment(synthesized)
        duration_ms = alignment[-1].audio_end_ms
        self.validator.validate(
            alignment,
            source_utf16_length=utf16_length(source_text),
            audio_duration_ms=duration_ms,
        )
        return NarrationResult(
            pcm_bytes=pcm,
            sample_rate_hz=synthesized[0].sample_rate_hz,
            channels=synthesized[0].channels,
            duration_ms=duration_ms,
            checksum=hashlib.sha256(pcm).hexdigest(),
            alignment=alignment,
        )
