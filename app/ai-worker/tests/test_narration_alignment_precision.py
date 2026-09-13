import pytest

from narrativex_worker.narration.alignment import NarrationAlignmentValidator
from narrativex_worker.narration.models import WordAlignment


def _word(
    index: int,
    text_start: int,
    text_end: int,
    audio_start_ms: int,
    audio_end_ms: int,
    confidence: float = 0.95,
) -> WordAlignment:
    return WordAlignment(
        index=index,
        text_start=text_start,
        text_end=text_end,
        audio_start_ms=audio_start_ms,
        audio_end_ms=audio_end_ms,
        confidence=confidence,
    )


def test_validator_allows_leading_and_trailing_silence() -> None:
    words = [
        _word(0, 0, 3, 220, 480),
        _word(1, 4, 9, 610, 930),
    ]

    NarrationAlignmentValidator().validate(
        words,
        source_utf16_length=9,
        audio_duration_ms=1_600,
    )


def test_validator_allows_real_pause_between_words() -> None:
    words = [
        _word(0, 0, 3, 100, 350),
        _word(1, 4, 8, 1_100, 1_430),
    ]

    NarrationAlignmentValidator().validate(
        words,
        source_utf16_length=8,
        audio_duration_ms=2_000,
    )


def test_validator_rejects_overlapping_word_audio() -> None:
    words = [
        _word(0, 0, 3, 100, 500),
        _word(1, 4, 8, 450, 800),
    ]

    with pytest.raises(ValueError, match="audio ranges overlap"):
        NarrationAlignmentValidator().validate(
            words,
            source_utf16_length=8,
            audio_duration_ms=1_000,
        )


def test_validator_rejects_word_past_final_audio_without_stretching_or_clamping() -> None:
    words = [_word(0, 0, 4, 100, 1_820)]

    with pytest.raises(ValueError, match="exceeds narration duration"):
        NarrationAlignmentValidator().validate(
            words,
            source_utf16_length=4,
            audio_duration_ms=1_800,
        )


def test_validator_requires_contiguous_word_indexes() -> None:
    words = [
        _word(0, 0, 3, 100, 300),
        _word(2, 4, 8, 350, 700),
    ]

    with pytest.raises(ValueError, match="indexes must be contiguous"):
        NarrationAlignmentValidator().validate(
            words,
            source_utf16_length=8,
            audio_duration_ms=1_000,
        )
