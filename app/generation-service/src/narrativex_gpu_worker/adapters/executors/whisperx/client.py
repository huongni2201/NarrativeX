from __future__ import annotations

import asyncio
import importlib
import re
import tempfile
import threading
from collections.abc import Mapping
from pathlib import Path
from typing import Any

_WORD_PATTERN = re.compile(r"[^\W_]+(?:['’][^\W_]+)*", re.UNICODE)


class WhisperXClientError(RuntimeError):
    """WhisperX alignment client error."""


class WhisperXClient:
    """Force-align a known script against the exact WAV bytes consumed by rendering."""

    def __init__(
        self,
        endpoint_url: str | None = None,
        *,
        device: str = "cuda",
        align_model_name: str | None = None,
        whisperx_module: Any | None = None,
    ) -> None:
        # endpoint_url remains accepted during the compute-plane migration so old config does not
        # break, but alignment is deliberately local: the compute worker owns the model runtime.
        self.endpoint_url = endpoint_url
        self.device = device
        self.align_model_name = align_model_name
        self._whisperx_module = whisperx_module
        self._models: dict[str, tuple[Any, Mapping[str, Any]]] = {}
        self._model_lock = threading.Lock()

    async def align(
        self,
        audio_bytes: bytes,
        script: str,
        language: str = "vi",
        model: str = "large-v3",
    ) -> list[dict[str, Any]]:
        del model
        if not audio_bytes:
            raise WhisperXClientError("Narration audio is empty")
        if not script.strip():
            raise WhisperXClientError("Narration script is empty")
        if not language.strip():
            raise WhisperXClientError("WhisperX forced alignment requires a language")
        return await asyncio.to_thread(self._align_sync, audio_bytes, script, language.lower())

    def _align_sync(
        self,
        audio_bytes: bytes,
        script: str,
        language: str,
    ) -> list[dict[str, Any]]:
        whisperx = self._load_whisperx()
        source_words = _source_words(script)
        if not source_words:
            raise WhisperXClientError("Narration contains no alignable words")

        with tempfile.TemporaryDirectory(prefix="narrativex-whisperx-") as temp_dir:
            wav_path = Path(temp_dir) / "narration.wav"
            wav_path.write_bytes(audio_bytes)
            try:
                audio = whisperx.load_audio(str(wav_path))
            except Exception as exception:
                raise WhisperXClientError(
                    "WhisperX could not decode narration audio"
                ) from exception

        duration_seconds = len(audio) / 16_000
        if duration_seconds <= 0:
            raise WhisperXClientError("Narration audio is empty")

        align_model, metadata = self._load_model(whisperx, language)
        try:
            aligned = whisperx.align(
                [{"text": script, "start": 0.0, "end": duration_seconds}],
                align_model,
                metadata,
                audio,
                self.device,
                return_char_alignments=False,
                print_progress=False,
            )
        except Exception as exception:
            raise WhisperXClientError("WhisperX forced alignment failed") from exception

        timed_words = _timed_words(aligned)
        if len(timed_words) != len(source_words):
            raise WhisperXClientError(
                "WhisperX/source token counts diverged; refusing to invent timing "
                f"sourceWords={len(source_words)} timedWords={len(timed_words)}"
            )

        result: list[dict[str, Any]] = []
        previous_audio_end = 0
        for index, (source, timed) in enumerate(zip(source_words, timed_words, strict=True)):
            if _comparison_key(source[0]) != _comparison_key(timed[0]):
                raise WhisperXClientError(
                    "WhisperX/source tokens diverged; refusing to invent timing "
                    f"index={index} source={source[0]!r} aligned={timed[0]!r}"
                )
            audio_start_ms = round(timed[1] * 1000)
            audio_end_ms = round(timed[2] * 1000)
            if audio_start_ms < previous_audio_end or audio_end_ms <= audio_start_ms:
                raise WhisperXClientError("WhisperX returned non-monotonic word timestamps")
            result.append(
                {
                    "index": index,
                    "textStart": source[1],
                    "textEnd": source[2],
                    "audioStartMs": audio_start_ms,
                    "audioEndMs": audio_end_ms,
                    "confidence": timed[3],
                }
            )
            previous_audio_end = audio_end_ms
        return result

    def _load_whisperx(self) -> Any:
        if self._whisperx_module is not None:
            return self._whisperx_module
        try:
            self._whisperx_module = importlib.import_module("whisperx")
        except ImportError as exception:
            raise WhisperXClientError(
                "WhisperX is not installed; install the generation-service narration extra"
            ) from exception
        return self._whisperx_module

    def _load_model(self, whisperx: Any, language: str) -> tuple[Any, Mapping[str, Any]]:
        with self._model_lock:
            cached = self._models.get(language)
            if cached is not None:
                return cached
            try:
                model, metadata = whisperx.load_align_model(
                    language_code=language,
                    device=self.device,
                    model_name=self.align_model_name,
                )
            except Exception as exception:
                raise WhisperXClientError(
                    f"WhisperX alignment model is unavailable for language {language}"
                ) from exception
            resolved = (model, dict(metadata))
            self._models[language] = resolved
            return resolved


def _source_words(script: str) -> list[tuple[str, int, int]]:
    utf16_offsets = [0]
    for character in script:
        utf16_offsets.append(utf16_offsets[-1] + (2 if ord(character) > 0xFFFF else 1))
    return [
        (match.group(0), utf16_offsets[match.start()], utf16_offsets[match.end()])
        for match in _WORD_PATTERN.finditer(script)
    ]


def _timed_words(result: Any) -> list[tuple[str, float, float, float]]:
    if not isinstance(result, Mapping):
        raise WhisperXClientError("WhisperX returned an invalid alignment payload")
    raw_words = result.get("word_segments")
    if not isinstance(raw_words, list):
        raw_words = []
        segments = result.get("segments")
        if isinstance(segments, list):
            for segment in segments:
                if isinstance(segment, Mapping) and isinstance(segment.get("words"), list):
                    raw_words.extend(segment["words"])

    words: list[tuple[str, float, float, float]] = []
    for item in raw_words:
        if not isinstance(item, Mapping):
            continue
        text = str(item.get("word", "")).strip()
        start = item.get("start")
        end = item.get("end")
        if not text or not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            continue
        score = item.get("score", 0.8)
        confidence = float(score) if isinstance(score, (int, float)) else 0.8
        words.append((text, float(start), float(end), max(0.0, min(confidence, 1.0))))
    return words


def _comparison_key(value: str) -> str:
    return "".join(character.casefold() for character in value if character.isalnum())


__all__ = ["WhisperXClient", "WhisperXClientError"]
