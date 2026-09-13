from __future__ import annotations

import re
import tempfile
import threading
import unicodedata
import wave
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from narrativex_worker.narration.models import WordAlignment

_WORD_PATTERN = re.compile(r"[^\W_]+(?:['’][^\W_]+)*", re.UNICODE)
_SUBSTITUTION_CONFIDENCE_CAP = 0.65
_INITIAL_PROMPT_CHARS = 1000


class WordAlignmentError(RuntimeError):
    """Raised when measured ASR timing cannot be reconciled safely to source words."""


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
    """Map narration audio to source words using measured Whisper timestamps.

    The aligner never manufactures word timestamps. Exact transcript matches retain
    Whisper confidence. Same-count ASR substitutions may reuse measured timed-token
    intervals with reduced confidence. A source token may also consume multiple measured
    Whisper tokens when their normalized text concatenates exactly to that source token;
    the source token then uses the measured first-start/last-end interval. Other token
    count divergence is rejected instead of fabricating timing.
    """

    def __init__(
        self,
        *,
        model_size: str = "small",
        device: str = "cpu",
        compute_type: str = "int8",
        minimum_exact_coverage: float = 0.75,
    ) -> None:
        if not 0.0 <= minimum_exact_coverage <= 1.0:
            raise ValueError("minimum_exact_coverage must be between 0 and 1")
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.minimum_exact_coverage = minimum_exact_coverage
        self._model: Any | None = None
        self._inference_lock = threading.Lock()

    def align(
        self,
        audio_path: Path,
        source_text: str,
        language: str = "",
    ) -> list[WordAlignment]:
        """Align the exact encoded narration file consumed by the renderer."""

        return self._align_audio(
            audio_path,
            source_text,
            text_base_utf16=0,
            language=_normalize_language(language),
        )

    def align_pcm(
        self,
        pcm_bytes: bytes,
        source_text: str,
        *,
        sample_rate_hz: int,
        channels: int,
        language: str = "",
    ) -> list[WordAlignment]:
        """Align an in-memory PCM aggregate for service/test call sites."""

        if not pcm_bytes:
            raise WordAlignmentError("Narration audio is empty")
        with tempfile.TemporaryDirectory(prefix="narrativex-word-align-") as temp_dir:
            wav_path = Path(temp_dir) / "narration.wav"
            _write_wav(
                wav_path,
                pcm_bytes,
                sample_rate_hz=sample_rate_hz,
                channels=channels,
            )
            return self._align_audio(
                wav_path,
                source_text,
                text_base_utf16=0,
                language=_normalize_language(language),
            )

    def _align_audio(
        self,
        audio_path: Path,
        source_text: str,
        *,
        text_base_utf16: int,
        language: str | None,
    ) -> list[WordAlignment]:
        source_words = _source_words(source_text, text_base_utf16=text_base_utf16)
        if not source_words:
            raise WordAlignmentError("Narration contains no alignable source words")
        if not audio_path.is_file():
            raise WordAlignmentError(f"Narration audio does not exist: {audio_path}")

        with self._inference_lock:
            model = self._load_model()
            segments, _ = model.transcribe(
                str(audio_path),
                language=language,
                beam_size=1,
                temperature=0.0,
                word_timestamps=True,
                condition_on_previous_text=False,
                vad_filter=False,
                initial_prompt=source_text[:_INITIAL_PROMPT_CHARS],
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


def _source_words(source_text: str, *, text_base_utf16: int) -> list[_SourceWord]:
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
                text_start=text_base_utf16 + utf16_offsets[match.start()],
                text_end=text_base_utf16 + utf16_offsets[match.end()],
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
    _validate_timed_words(result)
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
    opcodes = matcher.get_opcodes()

    exact_count = 0
    for tag, source_start, source_end, timed_start, timed_end in opcodes:
        if tag == "equal":
            exact_count += source_end - source_start
        elif tag == "replace" and _can_merge_timed_tokens(
            source_words[source_start:source_end],
            timed_words[timed_start:timed_end],
        ):
            exact_count += 1

    exact_coverage = exact_count / len(source_words)
    if exact_coverage < minimum_exact_coverage:
        raise WordAlignmentError(
            "Word alignment exact coverage "
            f"{exact_coverage:.3f} is below {minimum_exact_coverage:.3f}"
        )

    result: list[WordAlignment] = []
    for tag, source_start, source_end, timed_start, timed_end in opcodes:
        source_slice = source_words[source_start:source_end]
        timed_slice = timed_words[timed_start:timed_end]
        source_count = len(source_slice)
        timed_count = len(timed_slice)
        if tag == "equal":
            _append_measured_pairs(
                result,
                source_slice,
                timed_slice,
                confidence_cap=None,
            )
            continue
        if tag == "replace" and source_count == timed_count and source_count > 0:
            _append_measured_pairs(
                result,
                source_slice,
                timed_slice,
                confidence_cap=_SUBSTITUTION_CONFIDENCE_CAP,
            )
            continue
        if tag == "replace" and _can_merge_timed_tokens(source_slice, timed_slice):
            _append_measured_group(result, source_slice[0], timed_slice)
            continue
        raise WordAlignmentError(
            "Whisper/source token counts diverged; refusing to invent word timing "
            f"for opcode={tag} sourceWords={source_count} timedWords={timed_count}"
        )

    if len(result) != len(source_words):
        raise WordAlignmentError(
            f"Word alignment resolved {len(result)} of {len(source_words)} source words"
        )
    _validate_monotonic(result)
    return result


def _can_merge_timed_tokens(
    source_words: list[_SourceWord], timed_words: list[_TimedWord]
) -> bool:
    if len(source_words) != 1 or len(timed_words) <= 1:
        return False
    return source_words[0].key == "".join(word.key for word in timed_words)


def _append_measured_group(
    result: list[WordAlignment],
    source_word: _SourceWord,
    timed_words: list[_TimedWord],
) -> None:
    if not timed_words:
        raise WordAlignmentError("Measured token group must not be empty")
    result.append(
        WordAlignment(
            index=len(result),
            text_start=source_word.text_start,
            text_end=source_word.text_end,
            audio_start_ms=timed_words[0].audio_start_ms,
            audio_end_ms=timed_words[-1].audio_end_ms,
            confidence=min(word.confidence for word in timed_words),
        )
    )


def _append_measured_pairs(
    result: list[WordAlignment],
    source_words: list[_SourceWord],
    timed_words: list[_TimedWord],
    *,
    confidence_cap: float | None,
) -> None:
    if len(source_words) != len(timed_words):
        raise WordAlignmentError("Measured source/timed word counts must match")
    for source_word, timed_word in zip(source_words, timed_words, strict=True):
        confidence = timed_word.confidence
        if confidence_cap is not None:
            confidence = min(confidence_cap, confidence)
        result.append(
            WordAlignment(
                index=len(result),
                text_start=source_word.text_start,
                text_end=source_word.text_end,
                audio_start_ms=timed_word.audio_start_ms,
                audio_end_ms=timed_word.audio_end_ms,
                confidence=confidence,
            )
        )


def _validate_timed_words(words: list[_TimedWord]) -> None:
    previous: _TimedWord | None = None
    for word in words:
        if previous is not None and previous.audio_end_ms > word.audio_start_ms:
            raise WordAlignmentError("Whisper word timestamps overlap")
        previous = word


def _validate_monotonic(words: list[WordAlignment]) -> None:
    previous: WordAlignment | None = None
    for word in words:
        if previous is not None:
            if previous.text_end > word.text_start:
                raise WordAlignmentError("Source word ranges overlap after reconciliation")
            if previous.audio_end_ms > word.audio_start_ms:
                raise WordAlignmentError("Whisper word timestamps overlap after reconciliation")
        previous = word


def _write_wav(path: Path, pcm: bytes, *, sample_rate_hz: int, channels: int) -> None:
    with wave.open(str(path), "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(2)
        output.setframerate(sample_rate_hz)
        output.writeframes(pcm)


def _normalize_language(language: str) -> str | None:
    normalized = language.split("-", 1)[0].strip().lower()
    return normalized or None


def _comparison_key(value: str) -> str:
    normalized = unicodedata.normalize("NFC", value.casefold())
    return "".join(character for character in normalized if character.isalnum())
