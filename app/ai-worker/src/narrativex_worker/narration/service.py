import asyncio
import hashlib
from dataclasses import dataclass
from typing import Protocol

from narrativex_worker.narration.alignment import NarrationAlignmentValidator
from narrativex_worker.narration.models import WordAlignment
from narrativex_worker.narration.providers import TtsProvider, TtsRequest
from narrativex_worker.narration.segmenter import NarrationSegmenter, utf16_length
from narrativex_worker.narration.word_alignment import WhisperWordAligner


class WordAligner(Protocol):
    def align_pcm(
        self,
        pcm_bytes: bytes,
        source_text: str,
        *,
        sample_rate_hz: int,
        channels: int,
        language: str = "",
    ) -> list[WordAlignment]: ...


@dataclass(frozen=True)
class NarrationResult:
    pcm_bytes: bytes
    sample_rate_hz: int
    channels: int
    duration_ms: int
    checksum: str
    alignment: list[WordAlignment]


class FullChapterNarrationService:
    def __init__(
        self,
        provider: TtsProvider,
        *,
        segmenter: NarrationSegmenter | None = None,
        validator: NarrationAlignmentValidator | None = None,
        word_aligner: WordAligner | None = None,
    ) -> None:
        self.provider = provider
        self.segmenter = segmenter or NarrationSegmenter()
        self.validator = validator or NarrationAlignmentValidator()
        self.word_aligner = word_aligner or WhisperWordAligner()

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
        sample_rate_hz = synthesized[0].sample_rate_hz
        channels = synthesized[0].channels
        frame_count = len(pcm) // (2 * channels)
        duration_ms = round(frame_count * 1000 / sample_rate_hz)
        alignment = await asyncio.to_thread(
            self.word_aligner.align_pcm,
            pcm,
            source_text,
            sample_rate_hz=sample_rate_hz,
            channels=channels,
            language=language,
        )
        self.validator.validate(
            alignment,
            source_utf16_length=utf16_length(source_text),
            audio_duration_ms=duration_ms,
        )
        return NarrationResult(
            pcm_bytes=pcm,
            sample_rate_hz=sample_rate_hz,
            channels=channels,
            duration_ms=duration_ms,
            checksum=hashlib.sha256(pcm).hexdigest(),
            alignment=alignment,
        )
