from __future__ import annotations

import re
import tempfile
import threading
import unicodedata
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from narrativex_worker.narration.models import WordAlignment

_WORD_PATTERN = re.compile(r"[^\W_]+(?:['’][^\W_]+)*", re.UNICODE)
_DATE_PATTERN = re.compile(r"(?<!\d)(\d{1,2})/(\d{1,2})/(\d{2,4})(?!\d)")
_DECIMAL_PATTERN = re.compile(r"(?<!\d)(\d+)[.,](\d+)(?!\d)")
_SUBSTITUTION_CONFIDENCE_CAP = 0.65
_INITIAL_PROMPT_CHARS = 1000
_MAX_MEASURED_TOKENS_PER_SOURCE_WORD = 16
_VI_DIGITS = (
    "không",
    "một",
    "hai",
    "ba",
    "bốn",
    "năm",
    "sáu",
    "bảy",
    "tám",
    "chín",
)
_VI_ACRONYM_LETTERS = {
    "A": "ây",
    "B": "bi",
    "C": "xi",
    "D": "đi",
    "E": "i",
    "F": "ép",
    "G": "gi",
    "H": "âych",
    "I": "ai",
    "J": "giây",
    "K": "cây",
    "L": "eo",
    "M": "em",
    "N": "en",
    "O": "âu",
    "P": "pi",
    "Q": "kiu",
    "R": "a",
    "S": "ét",
    "T": "ti",
    "U": "diu",
    "V": "vi",
    "W": "đắp liu",
    "X": "ích",
    "Y": "oai",
    "Z": "di",
}


class WordAlignmentError(RuntimeError):
    """Raised when measured ASR timing cannot be reconciled safely to source words."""


@dataclass(frozen=True)
class _SourceWord:
    text: str
    text_start: int
    text_end: int
    key: str
    spoken_forms: tuple[str, ...] = ()


@dataclass(frozen=True)
class _TimedWord:
    text: str
    audio_start_ms: int
    audio_end_ms: int
    confidence: float
    key: str


@dataclass(frozen=True)
class _BackPointer:
    previous_timed_index: int
    exact: bool


class WhisperWordAligner:
    """Map narration audio to source words using measured Whisper timestamps.

    Every output interval comes directly from one or more contiguous Whisper word
    intervals. Language-aware speech normalization may group multiple measured tokens
    into one source word, but the aligner never splits or interpolates measured timing.
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
        source_words = _source_words(
            source_text,
            text_base_utf16=text_base_utf16,
            language=language,
        )
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


def _source_words(
    source_text: str,
    *,
    text_base_utf16: int,
    language: str | None = None,
) -> list[_SourceWord]:
    utf16_offsets = [0]
    for character in source_text:
        utf16_offsets.append(utf16_offsets[-1] + (2 if ord(character) > 0xFFFF else 1))

    contextual_forms = _speech_context_forms(source_text, language=language)
    words: list[_SourceWord] = []
    for match in _WORD_PATTERN.finditer(source_text):
        text = match.group(0)
        key = _comparison_key(text)
        if not key:
            continue
        spoken_forms = _spoken_forms(text, language=language)
        spoken_forms.update(contextual_forms.get((match.start(), match.end()), set()))
        spoken_forms.discard(key)
        words.append(
            _SourceWord(
                text=text,
                text_start=text_base_utf16 + utf16_offsets[match.start()],
                text_end=text_base_utf16 + utf16_offsets[match.end()],
                key=key,
                spoken_forms=tuple(sorted(spoken_forms)),
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
    if not source_words:
        return []
    if len(timed_words) < len(source_words):
        raise WordAlignmentError(
            "Whisper/source token counts diverged; refusing to split measured timing "
            f"sourceWords={len(source_words)} timedWords={len(timed_words)}"
        )

    scores: dict[int, int] = {0: 0}
    backpointers: list[dict[int, _BackPointer]] = []
    for source_word in source_words:
        next_scores: dict[int, int] = {}
        next_backpointers: dict[int, _BackPointer] = {}
        forms = {source_word.key, *source_word.spoken_forms}
        for timed_start, score in scores.items():
            _consider_path(
                next_scores,
                next_backpointers,
                timed_start + 1,
                score,
                _BackPointer(timed_start, False),
                timed_word_count=len(timed_words),
            )

            combined_key = ""
            max_end = min(
                len(timed_words),
                timed_start + _MAX_MEASURED_TOKENS_PER_SOURCE_WORD,
            )
            for timed_end in range(timed_start + 1, max_end + 1):
                combined_key += timed_words[timed_end - 1].key
                if combined_key not in forms:
                    continue
                _consider_path(
                    next_scores,
                    next_backpointers,
                    timed_end,
                    score + 1,
                    _BackPointer(timed_start, True),
                    timed_word_count=len(timed_words),
                )
        scores = next_scores
        backpointers.append(next_backpointers)

    if len(timed_words) not in scores:
        raise WordAlignmentError(
            "Whisper/source token counts diverged; refusing to invent word timing "
            f"sourceWords={len(source_words)} timedWords={len(timed_words)}"
        )

    exact_count = scores[len(timed_words)]
    exact_coverage = exact_count / len(source_words)
    if exact_coverage < minimum_exact_coverage:
        raise WordAlignmentError(
            "Word alignment exact coverage "
            f"{exact_coverage:.3f} is below {minimum_exact_coverage:.3f}"
        )

    resolved: list[tuple[int, int, bool]] = []
    timed_end = len(timed_words)
    for source_index in range(len(source_words) - 1, -1, -1):
        pointer = backpointers[source_index][timed_end]
        resolved.append((pointer.previous_timed_index, timed_end, pointer.exact))
        timed_end = pointer.previous_timed_index
    resolved.reverse()

    result: list[WordAlignment] = []
    for source_word, (timed_start, timed_end, exact) in zip(
        source_words,
        resolved,
        strict=True,
    ):
        measured = timed_words[timed_start:timed_end]
        confidence_cap = None if exact else _SUBSTITUTION_CONFIDENCE_CAP
        _append_measured_group(
            result,
            source_word,
            measured,
            confidence_cap=confidence_cap,
        )

    _validate_monotonic(result)
    return result


def _consider_path(
    scores: dict[int, int],
    backpointers: dict[int, _BackPointer],
    timed_end: int,
    score: int,
    pointer: _BackPointer,
    *,
    timed_word_count: int,
) -> None:
    if timed_end > timed_word_count:
        return
    previous_score = scores.get(timed_end)
    if previous_score is not None and previous_score >= score:
        return
    scores[timed_end] = score
    backpointers[timed_end] = pointer


def _append_measured_group(
    result: list[WordAlignment],
    source_word: _SourceWord,
    timed_words: list[_TimedWord],
    *,
    confidence_cap: float | None,
) -> None:
    if not timed_words:
        raise WordAlignmentError("Measured token group must not be empty")
    confidence = min(word.confidence for word in timed_words)
    if confidence_cap is not None:
        confidence = min(confidence_cap, confidence)
    result.append(
        WordAlignment(
            index=len(result),
            text_start=source_word.text_start,
            text_end=source_word.text_end,
            audio_start_ms=timed_words[0].audio_start_ms,
            audio_end_ms=timed_words[-1].audio_end_ms,
            confidence=confidence,
        )
    )


def _spoken_forms(value: str, *, language: str | None) -> set[str]:
    if language != "vi":
        return set()

    forms: set[str] = set()
    if value.isdigit():
        forms.update(_vietnamese_number_forms(value))
    if value.isascii() and value.isalpha() and value.isupper() and 1 < len(value) <= 8:
        acronym = "".join(_VI_ACRONYM_LETTERS.get(letter, letter) for letter in value)
        forms.add(_comparison_key(acronym))
    return forms


def _speech_context_forms(
    source_text: str,
    *,
    language: str | None,
) -> dict[tuple[int, int], set[str]]:
    if language != "vi":
        return {}

    result: dict[tuple[int, int], set[str]] = {}
    for match in _WORD_PATTERN.finditer(source_text):
        if not match.group(0).isdigit():
            continue
        suffix = source_text[match.end() :]
        if suffix.lstrip().startswith("%"):
            _add_contextual_forms(
                result,
                (match.start(), match.end()),
                _vietnamese_number_forms(match.group(0)),
                suffix="phần trăm",
            )

    for match in _DATE_PATTERN.finditer(source_text):
        prefixes = ("ngày", "tháng", "năm")
        for group_index, prefix in enumerate(prefixes, start=1):
            _add_contextual_forms(
                result,
                match.span(group_index),
                _vietnamese_number_forms(match.group(group_index)),
                prefix=prefix,
            )

    for match in _DECIMAL_PATTERN.finditer(source_text):
        fractional_forms = _vietnamese_number_forms(match.group(2))
        for prefix in ("phẩy", "chấm"):
            _add_contextual_forms(
                result,
                match.span(2),
                fractional_forms,
                prefix=prefix,
            )
    return result


def _add_contextual_forms(
    result: dict[tuple[int, int], set[str]],
    span: tuple[int, int],
    base_forms: set[str],
    *,
    prefix: str = "",
    suffix: str = "",
) -> None:
    forms = result.setdefault(span, set())
    normalized_prefix = _comparison_key(prefix)
    normalized_suffix = _comparison_key(suffix)
    for form in base_forms:
        forms.add(normalized_prefix + form + normalized_suffix)


def _vietnamese_number_forms(value: str) -> set[str]:
    normalized_digits = value.lstrip("0") or "0"
    forms = {normalized_digits}
    if len(value) > 1:
        forms.add(value)

    digit_words = [_VI_DIGITS[int(character)] for character in value]
    forms.add(_comparison_key(" ".join(digit_words)))

    if len(normalized_digits) > 12:
        return forms
    number = int(normalized_digits)
    for words in _read_vietnamese_integer(number, preserve_lower_hundreds=True):
        forms.add(_comparison_key(" ".join(words)))
    for words in _read_vietnamese_integer(number, preserve_lower_hundreds=False):
        forms.add(_comparison_key(" ".join(words)))
    return forms


def _read_vietnamese_integer(
    value: int,
    *,
    preserve_lower_hundreds: bool,
) -> set[tuple[str, ...]]:
    if value == 0:
        return {("không",)}

    scales = ("", "nghìn", "triệu", "tỷ")
    groups: list[int] = []
    remaining = value
    while remaining:
        groups.append(remaining % 1000)
        remaining //= 1000
    if len(groups) > len(scales):
        return set()

    variants: set[tuple[str, ...]] = {()}
    highest_index = len(groups) - 1
    for group_index in range(highest_index, -1, -1):
        group_value = groups[group_index]
        if group_value == 0:
            continue
        force_hundreds = (
            preserve_lower_hundreds
            and group_index < highest_index
            and group_value < 100
        )
        group_variants = _read_vietnamese_triplet(group_value, force_hundreds=force_hundreds)
        scale = scales[group_index]
        expanded: set[tuple[str, ...]] = set()
        for prefix in variants:
            for group_words in group_variants:
                suffix = group_words + ((scale,) if scale else ())
                expanded.add(prefix + suffix)
        variants = expanded
    return variants


def _read_vietnamese_triplet(value: int, *, force_hundreds: bool) -> set[tuple[str, ...]]:
    hundreds = value // 100
    remainder = value % 100
    variants: set[tuple[str, ...]] = {()}
    if hundreds or force_hundreds:
        hundreds_word = _VI_DIGITS[hundreds]
        variants = {(hundreds_word, "trăm")}
        if remainder and remainder < 10:
            bridged = {
                prefix + (bridge,)
                for prefix in variants
                for bridge in ("linh", "lẻ")
            }
            variants = bridged | variants
    if remainder == 0:
        return variants

    tens = remainder // 10
    ones = remainder % 10
    if tens == 0:
        return {prefix + (_VI_DIGITS[ones],) for prefix in variants}
    if tens == 1:
        base = ("mười",)
    else:
        base = (_VI_DIGITS[tens], "mươi")
    if ones == 0:
        return {prefix + base for prefix in variants}

    ones_variants = {_VI_DIGITS[ones]}
    if tens >= 2 and ones == 1:
        ones_variants.add("mốt")
    if tens >= 2 and ones == 4:
        ones_variants.add("tư")
    if tens >= 1 and ones == 5:
        ones_variants.add("lăm")
    return {
        prefix + base + (ones_word,)
        for prefix in variants
        for ones_word in ones_variants
    }


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
