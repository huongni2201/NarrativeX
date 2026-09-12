from narrativex_worker.narration.models import WordAlignment


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
