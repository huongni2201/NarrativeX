import pytest

from narrativex_worker.translation import TranslationValidationError, chunk_text, validate_translation


def test_chunking_prefers_sentence_boundaries() -> None:
    chunks = chunk_text("First sentence. Second sentence.\n\nThird paragraph.", max_characters=24)

    assert chunks == ["First sentence.", "Second sentence.", "Third paragraph."]


def test_validation_preserves_markers_and_rejects_provider_preamble() -> None:
    validate_translation("Hello [SFX] world.", "Xin chào [SFX] thế giới.")

    with pytest.raises(TranslationValidationError):
        validate_translation("Hello [SFX] world.", "Here is the translation: Xin chào [SFX] thế giới.")


def test_validation_rejects_lost_marker() -> None:
    with pytest.raises(TranslationValidationError, match="lost markers"):
        validate_translation("Hello [SFX] world.", "Xin chào thế giới.")
