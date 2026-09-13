import pytest

from narrativex_worker.narration import word_alignment


def _timed(
    text: str,
    start_ms: int,
    end_ms: int,
    confidence: float = 0.95,
) -> word_alignment._TimedWord:
    return word_alignment._TimedWord(
        text=text,
        audio_start_ms=start_ms,
        audio_end_ms=end_ms,
        confidence=confidence,
        key=word_alignment._comparison_key(text),
    )


def test_reconcile_merges_exact_measured_token_split_without_inventing_timing() -> None:
    source = word_alignment._source_words("OpenAI", text_base_utf16=0)
    timed = [
        _timed("Open", 120, 330, 0.97),
        _timed("AI", 350, 540, 0.93),
    ]

    words = word_alignment._reconcile_words(source, timed, minimum_exact_coverage=1.0)

    assert len(words) == 1
    assert words[0].text_start == 0
    assert words[0].text_end == 6
    assert words[0].audio_start_ms == 120
    assert words[0].audio_end_ms == 540
    assert words[0].confidence == pytest.approx(0.93)


def test_reconcile_keeps_exact_numeric_token_measured() -> None:
    source = word_alignment._source_words("2026", text_base_utf16=0)
    timed = [_timed("2026", 200, 640)]

    words = word_alignment._reconcile_words(source, timed, minimum_exact_coverage=1.0)

    assert [(word.audio_start_ms, word.audio_end_ms) for word in words] == [(200, 640)]


def test_reconcile_vietnamese_year_uses_only_measured_word_envelope() -> None:
    source = word_alignment._source_words("Năm 2026", text_base_utf16=0, language="vi")
    timed = [
        _timed("Năm", 100, 240),
        _timed("hai", 260, 360),
        _timed("nghìn", 380, 500),
        _timed("không", 520, 640),
        _timed("trăm", 660, 760),
        _timed("hai", 780, 870),
        _timed("mươi", 890, 980),
        _timed("sáu", 1000, 1110),
    ]

    words = word_alignment._reconcile_words(source, timed, minimum_exact_coverage=1.0)

    assert len(words) == 2
    assert words[1].audio_start_ms == 260
    assert words[1].audio_end_ms == 1110
    assert words[1].confidence == pytest.approx(0.95)


def test_reconcile_vietnamese_percent_consumes_spoken_suffix_without_interpolation() -> None:
    source = word_alignment._source_words("Tăng 10%", text_base_utf16=0, language="vi")
    timed = [
        _timed("Tăng", 0, 150),
        _timed("mười", 180, 300),
        _timed("phần", 320, 410),
        _timed("trăm", 430, 540),
    ]

    words = word_alignment._reconcile_words(source, timed, minimum_exact_coverage=1.0)

    assert len(words) == 2
    assert words[1].audio_start_ms == 180
    assert words[1].audio_end_ms == 540


def test_reconcile_vietnamese_date_preserves_original_utf16_word_ranges() -> None:
    source = word_alignment._source_words("12/09/2026", text_base_utf16=0, language="vi")
    timed = [
        _timed("ngày", 0, 80),
        _timed("mười", 90, 160),
        _timed("hai", 170, 220),
        _timed("tháng", 230, 300),
        _timed("chín", 310, 380),
        _timed("năm", 390, 450),
        _timed("hai", 460, 520),
        _timed("nghìn", 530, 600),
        _timed("không", 610, 680),
        _timed("trăm", 690, 750),
        _timed("hai", 760, 820),
        _timed("mươi", 830, 890),
        _timed("sáu", 900, 960),
    ]

    words = word_alignment._reconcile_words(source, timed, minimum_exact_coverage=1.0)

    assert [(word.text_start, word.text_end) for word in words] == [(0, 2), (3, 5), (6, 10)]
    assert [(word.audio_start_ms, word.audio_end_ms) for word in words] == [
        (0, 220),
        (230, 380),
        (390, 960),
    ]


def test_reconcile_vietnamese_acronym_uses_measured_letter_pronunciations() -> None:
    source = word_alignment._source_words("AI", text_base_utf16=0, language="vi")
    timed = [_timed("ây", 100, 260), _timed("ai", 280, 430)]

    words = word_alignment._reconcile_words(source, timed, minimum_exact_coverage=1.0)

    assert len(words) == 1
    assert words[0].audio_start_ms == 100
    assert words[0].audio_end_ms == 430


def test_reconcile_rejects_many_source_words_for_one_timed_token() -> None:
    source = word_alignment._source_words("Open AI", text_base_utf16=0)
    timed = [_timed("OpenAI", 100, 500)]

    with pytest.raises(
        word_alignment.WordAlignmentError,
        match="refusing to split measured timing",
    ):
        word_alignment._reconcile_words(source, timed, minimum_exact_coverage=0.0)


def test_reconcile_same_count_substitution_uses_measured_intervals_with_capped_confidence() -> None:
    source = [
        word_alignment._SourceWord(text="xin", text_start=0, text_end=3, key="xin"),
        word_alignment._SourceWord(text="chào", text_start=4, text_end=8, key="chào"),
    ]
    timed = [
        _timed("xin", 100, 250),
        _timed("chao", 280, 520, 0.99),
    ]

    words = word_alignment._reconcile_words(source, timed, minimum_exact_coverage=0.5)

    assert len(words) == 2
    assert words[1].audio_start_ms == 280
    assert words[1].audio_end_ms == 520
    assert words[1].confidence == pytest.approx(0.65)
