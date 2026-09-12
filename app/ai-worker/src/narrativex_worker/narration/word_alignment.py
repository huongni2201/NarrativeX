from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from narrativex_worker.narration.models import WordAlignment

_WORD_PATTERN = re.compile(r"[^\W_]+(?:['’][^\W_]+)*", re.UNICODE)


class WordAlignmentError(RuntimeError):
    pass


@dataclass(frozen=True)
class _SourceWord:
    text: str
    text_start: int
    text_end: int
    key: str


@dataclass(frozen=True)
class _TimedWord:
    text: str
    audio_start_ms: int
    audio_end_ms: int
    confidence: float
    key: str


class WhisperWordAligner:
    """Align synthesized narration back to source words with Whisper word timestamps.

    Whisper supplies measured speech boundaries. Source text remains authoritative for text
    offsets; ASR text is used only to reconcile the measured word clock back to those offsets.
    """

    def __init__(
        self,
        *,
        model_size: str = "small",
        device: str = "cpu",
        compute_type: str = "int8",
        minimum_exact_coverage: float = 0.75,
    ) -> None:
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.minimum_exact_coverage = minimum_exact_coverage
        self._model: Any | None = None

    def align(self, audio_path: Path, source_text: str, language: str) -> list[WordAlignment]:
        source_words = _source_words(source_text)
        if not source_words:
            raise WordAlignmentError("Narration source contains no alignable words")

        model = self._load_model()
        whisper_language = language.split("-", 1)[0].strip().lower() or None
        segments, _ = model.transcribe(
            str(audio_path),
            language=whisper_language,
            beam_size=1,
            temperature=0.0,
            word_timestamps=True,
            condition_on_previous_text=False,
            vad_filter=False,
            initial_prompt=source_text[:4000],
        )
        timed_words = _timed_words(list(segments))
        if not timed_words:
            raise WordAlignmentError("Whisper returned no word timestamps")

        return _reconcile_words(
            source_words,
            timed_words,
            minimum_exact_coverage=self.minimum_exact_coverage,
        )

    def _load_model(self) -> Any:
        if self._model is not None:
            return self._model
        try:
            from faster_whisper import WhisperModel  # type: ignore[import-not-found]
        except ImportError as exception:
            raise WordAlignmentError(
                "Word alignment requires the narration dependency faster-whisper"
            ) from exception
        self._model = WhisperModel(
            self.model_size,
            device=self.device,
            compute_type=self.compute_type,
        )
        return self._model


def _source_words(source_text: str) -> list[_SourceWord]:
    utf16_offsets = [0]
    for character in source_text:
        utf16_offsets.append(utf16_offsets[-1] + (2 if ord(character) > 0xFFFF else 1))

    words: list[_SourceWord] = []
    for match in _WORD_PATTERN.finditer(source_text):
        text = match.group(0)
        key = _comparison_key(text)
        if not key:
            continue
        words.append(
            _SourceWord(
                text=text,
                text_start=utf16_offsets[match.start()],
                text_end=utf16_offsets[match.end()],
                key=key,
            )
        )
    return words


def _timed_words(segments: list[Any]) -> list[_TimedWord]:
    result: list[_TimedWord] = []
    for segment in segments:
        for word in getattr(segment, "words", None) or []:
            text = str(getattr(word, "word", "")).strip()
            key = _comparison_key(text)
            start = getattr(word, "start", None)
            end = getattr(word, "end", None)
            if not key or start is None or end is None:
                continue
            start_ms = round(float(start) * 1000)
            end_ms = round(float(end) * 1000)
            if start_ms < 0 or end_ms <= start_ms:
                continue
            probability = getattr(word, "probability", None)
            confidence = 0.8 if probability is None else float(probability)
            confidence = max(0.0, min(confidence, 1.0))
            result.append(
                _TimedWord(
                    text=text,
                    audio_start_ms=start_ms,
                    audio_end_ms=end_ms,
                    confidence=confidence,
                    key=key,
                )
            )
    return result


def _reconcile_words(
    source_words: list[_SourceWord],
    timed_words: list[_TimedWord],
    *,
    minimum_exact_coverage: float,
) -> list[WordAlignment]:
    source_keys = [word.key for word in source_words]
    timed_keys = [word.key for word in timed_words]
    matcher = SequenceMatcher(a=source_keys, b=timed_keys, autojunk=False)
    blocks = matcher.get_matching_blocks()
    exact_count = sum(block.size for block in blocks)
    exact_coverage = exact_count / len(source_words)
    if exact_coverage < minimum_exact_coverage:
        raise WordAlignmentError(
            "Word alignment exact coverage "
            f"{exact_coverage:.3f} is below {minimum_exact_coverage:.3f}"
        )

    result: list[WordAlignment] = []
    source_cursor = 0
    timed_cursor = 0
    for block in blocks:
        _append_gap_words(
            result,
            source_words[source_cursor : block.a],
            timed_words[timed_cursor : block.b],
            right_word=(timed_words[block.b] if block.size > 0 else None),
        )
        for offset in range(block.size):
            source_word = source_words[block.a + offset]
            timed_word = timed_words[block.b + offset]
            result.append(
                WordAlignment(
                    index=len(result),
                    text_start=source_word.text_start,
                    text_end=source_word.text_end,
                    audio_start_ms=timed_word.audio_start_ms,
                    audio_end_ms=timed_word.audio_end_ms,
                    confidence=timed_word.confidence,
                )
            )
        source_cursor = block.a + block.size
        timed_cursor = block.b + block.size

    if len(result) != len(source_words):
        raise WordAlignmentError(
            f"Word alignment resolved {len(result)} of {len(source_words)} source words"
        )
    _validate_monotonic(result)
    return result


def _append_gap_words(
    result: list[WordAlignment],
    source_gap: list[_SourceWord],
    timed_gap: list[_TimedWord],
    *,
    right_word: _TimedWord | None,
) -> None:
    if not source_gap:
        return

    if timed_gap:
        start_ms = timed_gap[0].audio_start_ms
        end_ms = timed_gap[-1].audio_end_ms
        confidence = min(0.65, sum(word.confidence for word in timed_gap) / len(timed_gap))
    else:
        left_end = result[-1].audio_end_ms if result else None
        right_start = right_word.audio_start_ms if right_word is not None else None
        if left_end is None or right_start is None or right_start <= left_end:
            raise WordAlignmentError("Cannot resolve unmatched source words at alignment boundary")
        start_ms = left_end
        end_ms = right_start
        confidence = 0.5

    duration_ms = end_ms - start_ms
    if duration_ms < len(source_gap):
        raise WordAlignmentError("Unmatched word interval is too short to preserve ordering")

    for offset, source_word in enumerate(source_gap):
        word_start = start_ms + round(duration_ms * offset / len(source_gap))
        word_end = start_ms + round(duration_ms * (offset + 1) / len(source_gap))
        if word_end <= word_start:
            raise WordAlignmentError("Resolved word interval is empty")
        result.append(
            WordAlignment(
                index=len(result),
                text_start=source_word.text_start,
                text_end=source_word.text_end,
                audio_start_ms=word_start,
                audio_end_ms=word_end,
                confidence=confidence,
            )
        )


def _validate_monotonic(words: list[WordAlignment]) -> None:
    previous: WordAlignment | None = None
    for word in words:
        if previous is not None and previous.audio_end_ms > word.audio_start_ms:
            raise WordAlignmentError("Whisper word timestamps overlap after source reconciliation")
        previous = word


def _comparison_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    return "".join(
        character
        for character in normalized
        if not unicodedata.combining(character) and character.isalnum()
    )
