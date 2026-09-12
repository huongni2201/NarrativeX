from collections.abc import Sequence
from dataclasses import replace

from narrativex_worker.narration.models import (
    MaterializedAudioSegment,
    SynthesizedSegment,
    WordAlignment,
)
from narrativex_worker.narration.word_alignment import default_word_aligner


class NarrationAlignmentValidator:
    """Validate word timing without requiring subtitles to cover silence."""

    def validate(
        self,
        words: list[WordAlignment],
        *,
        source_utf16_length: int,
        audio_duration_ms: int,
    ) -> None:
        if not words:
            raise ValueError("alignment must contain at least one word")
        if source_utf16_length <= 0:
            raise ValueError("source_utf16_length must be positive")
        if audio_duration_ms <= 0:
            raise ValueError("audio_duration_ms must be positive")

        previous: WordAlignment | None = None
        for expected_index, word in enumerate(words):
            if word.index != expected_index:
                raise ValueError("word alignment indexes must be contiguous")
            if word.text_end > source_utf16_length:
                raise ValueError("word text range exceeds source length")
            if word.audio_end_ms > audio_duration_ms:
                raise ValueError("word audio range exceeds narration duration")
            if previous is not None:
                if previous.text_end > word.text_start:
                    raise ValueError("word text ranges overlap")
                if previous.audio_end_ms > word.audio_start_ms:
                    raise ValueError("word audio ranges overlap")
            previous = word


def build_alignment(
    segments: Sequence[SynthesizedSegment | MaterializedAudioSegment],
) -> list[WordAlignment]:
    """Build authoritative word timing from synthesized audio, never text-duration weighting."""

    return default_word_aligner().align_segments(list(segments))


def normalize_alignment_duration(
    words: Sequence[WordAlignment],
    *,
    audio_duration_ms: int,
    max_drift_ms: int = 250,
) -> list[WordAlignment]:
    """Clamp tiny codec overshoot only; never stretch speech across trailing silence."""

    if not words:
        raise ValueError("alignment must contain at least one word")
    if audio_duration_ms <= 0:
        raise ValueError("audio_duration_ms must be positive")

    normalized: list[WordAlignment] = []
    for word in words:
        if word.audio_end_ms <= audio_duration_ms:
            normalized.append(word)
            continue
        overshoot = word.audio_end_ms - audio_duration_ms
        if overshoot > max_drift_ms or word.audio_start_ms >= audio_duration_ms:
            raise ValueError(f"word alignment exceeds audio duration by {overshoot}ms")
        normalized.append(replace(word, audio_end_ms=audio_duration_ms))
    return normalized
