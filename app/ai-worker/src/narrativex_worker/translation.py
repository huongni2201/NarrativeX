"""Provider-neutral translation chunking and output validation."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from narrativex_worker.providers.ports import ProviderBilling


@dataclass(frozen=True)
class TranslationRequest:
    source_text: str
    source_language: str
    target_language: str
    previous_context: str = ""
    next_context: str = ""
    character_glossary: tuple[tuple[str, str], ...] = ()
    location_glossary: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class TranslationResult:
    content: str
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    billing: ProviderBilling | None = None


@dataclass(frozen=True)
class TranslationProviderResponse:
    """Raw provider output and billing captured before application validation."""

    content: str
    provider: str
    model: str
    billing: ProviderBilling


class TranslationProvider(Protocol):
    async def translate(self, request: TranslationRequest) -> TranslationProviderResponse: ...


class TranslationValidationError(ValueError):
    """Translation output failed a structural safety check."""


def chunk_text(text: str, max_characters: int = 12_000) -> list[str]:
    """Split by paragraphs, then sentences, and only then by a hard limit."""
    if max_characters < 1:
        raise ValueError("max_characters must be positive")
    paragraphs = re.split(r"(\n\s*\n)", text)
    chunks: list[str] = []
    current = ""
    for part in paragraphs:
        candidate = current + part
        if len(candidate) <= max_characters:
            current = candidate
            continue
        if current.strip():
            chunks.extend(_split_sentences(current, max_characters))
        current = part
    if current.strip():
        chunks.extend(_split_sentences(current, max_characters))
    return [chunk.strip() for chunk in chunks if chunk.strip()]


def validate_translation(source: str, translated: str) -> None:
    if not translated.strip():
        raise TranslationValidationError("translation output is empty")
    lowered = translated.lstrip().lower()
    if lowered.startswith(("here is", "sure,", "translation:", "bản dịch:")):
        raise TranslationValidationError("translation contains provider preamble")
    source_markers = _markers(source)
    translated_markers = _markers(translated)
    missing = source_markers - translated_markers
    if missing:
        raise TranslationValidationError(f"translation lost markers: {sorted(missing)}")
    source_paragraphs = max(1, len(re.split(r"\n\s*\n", source.strip())))
    translated_paragraphs = max(1, len(re.split(r"\n\s*\n", translated.strip())))
    if (
        translated_paragraphs > source_paragraphs * 2
        or source_paragraphs > translated_paragraphs * 2
    ):
        raise TranslationValidationError("translation paragraph count changed unexpectedly")
    ratio = len(translated) / max(1, len(source))
    if ratio < 0.25 or ratio > 4.0:
        raise TranslationValidationError("translation length ratio is outside safe bounds")


def _split_sentences(text: str, max_characters: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?。！？])\s+", text)
    result: list[str] = []
    current = ""
    for sentence in sentences:
        if len(sentence) > max_characters:
            if current.strip():
                result.append(current)
                current = ""
            result.extend(
                sentence[index : index + max_characters]
                for index in range(0, len(sentence), max_characters)
            )
        elif len(current) + len(sentence) + 1 <= max_characters:
            current = f"{current} {sentence}".strip()
        else:
            result.append(current)
            current = sentence
    if current.strip():
        result.append(current)
    return result


def _markers(text: str) -> set[str]:
    return set(re.findall(r"\[(?:SFX|MUSIC|PAUSE|SCENE|\d+)\]", text, flags=re.IGNORECASE))
