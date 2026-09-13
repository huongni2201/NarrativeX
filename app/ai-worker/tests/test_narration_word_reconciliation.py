import pytest

from narrativex_worker.narration.word_alignment import (
    WordAlignmentError,
    _SourceWord,
    _TimedWord,
    _reconcile_words,
    _source_words,
)


def _timed(
    text: str,
    start_ms: int,
    end_ms: int,
    confidence: float = 0.95,
) -> _TimedWord:
    return _TimedWord(
        text=text,
        audio_start_ms=start_ms,
        audio_end_ms=end_ms,
        confidence=confidence,
        key="".join(character for character in text.casefold() if character.isalnum()),
    )


def test_reconcile_merges_exact_measured_token_split_without_inventing_timing() -> None:
    source = _source_words("OpenAI", text_base_utf16=0)
    timed = [
        _timed("Open", 120, 330, 0.97),
        _timed("AI", 350, 540, 0.93),
    ]

    words = _reconcile_words(source, timed, minimum_exact_coverage=1.0)

    assert len(words) == 1
    assert words[0].text_start == 0
    assert words[0].text_end == 6
    assert words[0].audio_start_ms == 120
    assert words[0].audio_end_ms == 540
    assert words[0].confidence == pytest.approx(0.93)


def test_reconcile_keeps_exact_numeric_token_measured() -> None:
    source = _source_words("2026", text_base_utf16=0)
    timed = [_timed("2026", 200, 640)]

    words = _reconcile_words(source, timed, minimum_exact_coverage=1.0)

    assert [(word.audio_start_ms, word.audio_end_ms) for word in words] == [(200, 640)]


def test_reconcile_rejects_many_source_words_for_one_timed_token() -> None:
    source = _source_words("Open AI", text_base_utf16=0)
    timed = [_timed("OpenAI", 100, 500)]

    with pytest.raises(WordAlignmentError, match="refusing to invent word timing"):
        _reconcile_words(source, timed, minimum_exact_coverage=0.0)


def test_reconcile_same_count_substitution_uses_measured_intervals_with_capped_confidence() -> None:
    source = [
        _SourceWord(text="xin", text_start=0, text_end=3, key="xin"),
        _SourceWord(text="chào", text_start=4, text_end=8, key="chào"),
    ]
    timed = [
        _timed("xin", 100, 250),
        _timed("chao", 280, 520, 0.99),
    ]

    words = _reconcile_words(source, timed, minimum_exact_coverage=0.5)

    assert len(words) == 2
    assert words[1].audio_start_ms == 280
    assert words[1].audio_end_ms == 520
    assert words[1].confidence == pytest.approx(0.65)
