import asyncio
import re

import pytest

from narrativex_worker.narration.alignment import NarrationAlignmentValidator
from narrativex_worker.narration.models import WordAlignment
from narrativex_worker.narration.providers import FakeTtsProvider
from narrativex_worker.narration.segmenter import NarrationSegmenter, utf16_length
from narrativex_worker.narration.service import FullChapterNarrationService


def test_segmenter_preserves_utf16_offsets_for_unicode() -> None:
    text = "Xin chào 👋. Đây là chương đầu tiên. 日本語もあります。"
    segments = NarrationSegmenter(max_chars=64).segment(text)
    assert segments[0].text_start == 0
    assert segments[-1].text_end == utf16_length(text)
    assert "".join(segment.text for segment in segments) == text
    assert all(a.text_end <= b.text_start for a, b in zip(segments, segments[1:], strict=False))


def test_default_segmenter_optimizes_tts_request_size_not_subtitle_cue_size() -> None:
    sentence = "Câu kể tự nhiên có nhiều từ nhưng vẫn ngắn hơn giới hạn TTS. "
    source = sentence * 8
    segments = NarrationSegmenter().segment(source)

    assert len(segments) == 1
    assert len(segments[0].text) > 96
    assert "".join(segment.text for segment in segments) == source


def test_segmenter_splits_long_text_without_losing_source() -> None:
    source = ("một cụm từ dài " * 120).strip()
    segments = NarrationSegmenter(max_chars=96).segment(source)

    assert len(segments) > 1
    assert all(len(segment.text) <= 96 for segment in segments)
    assert "".join(segment.text for segment in segments) == source


def test_alignment_validator_rejects_overlap() -> None:
    validator = NarrationAlignmentValidator()
    with pytest.raises(ValueError, match="word audio ranges overlap"):
        validator.validate(
            [
                WordAlignment(0, 0, 3, 100, 1000, 0.95),
                WordAlignment(1, 4, 8, 900, 1800, 0.95),
            ],
            source_utf16_length=8,
            audio_duration_ms=2000,
        )


def test_alignment_validator_allows_leading_and_trailing_silence() -> None:
    NarrationAlignmentValidator().validate(
        [WordAlignment(0, 0, 3, 120, 640, 0.95)],
        source_utf16_length=3,
        audio_duration_ms=1400,
    )


class _FakeWordAligner:
    def align_pcm(
        self,
        pcm_bytes: bytes,
        source_text: str,
        *,
        sample_rate_hz: int,
        channels: int,
        language: str = "",
    ) -> list[WordAlignment]:
        del language
        matches = list(re.finditer(r"\S+", source_text))
        duration_ms = round((len(pcm_bytes) // (2 * channels)) * 1000 / sample_rate_hz)
        speech_start_ms = min(40, max(0, duration_ms // 20))
        speech_end_ms = max(speech_start_ms + len(matches), duration_ms - speech_start_ms)
        speech_duration_ms = max(1, speech_end_ms - speech_start_ms)
        words: list[WordAlignment] = []
        for index, match in enumerate(matches):
            text_start = utf16_length(source_text[: match.start()])
            text_end = utf16_length(source_text[: match.end()])
            audio_start_ms = speech_start_ms + round(speech_duration_ms * index / len(matches))
            audio_end_ms = speech_start_ms + round(
                speech_duration_ms * (index + 1) / len(matches)
            )
            words.append(
                WordAlignment(
                    index,
                    text_start,
                    text_end,
                    audio_start_ms,
                    max(audio_start_ms + 1, audio_end_ms),
                    1.0,
                )
            )
        return words


def test_full_chapter_fake_tts_acceptance_uses_injected_word_aligner() -> None:
    paragraph = (
        "Một câu chuyện dài bắt đầu ở đây. Nhân vật bước qua cánh cửa và nhìn ra thành phố. "
    )
    source = paragraph * 120
    service = FullChapterNarrationService(FakeTtsProvider(), word_aligner=_FakeWordAligner())
    result = asyncio.run(
        service.synthesize(
            narration_request_id="req-1",
            source_text=source,
            voice_id="voice-vi-1",
            language="vi-VN",
        )
    )
    assert result.duration_ms > 0
    assert len(result.alignment) > 1
    assert result.alignment[0].audio_start_ms >= 0
    assert result.alignment[-1].audio_end_ms <= result.duration_ms
    assert len(result.checksum) == 64


def test_media_storage_is_immutable() -> None:
    from narrativex_worker.narration.storage import InMemoryMediaStorage, MediaAssetConflictError

    storage = InMemoryMediaStorage()
    first = asyncio.run(
        storage.put_immutable(
            storage_key="narration/request-1/chapter.pcm",
            content=b"a",
            checksum="1" * 64,
            mime_type="audio/L16",
        )
    )
    duplicate = asyncio.run(
        storage.put_immutable(
            storage_key="narration/request-1/chapter.pcm",
            content=b"a",
            checksum="1" * 64,
            mime_type="audio/L16",
        )
    )
    assert duplicate == first
    with pytest.raises(MediaAssetConflictError):
        asyncio.run(
            storage.put_immutable(
                storage_key="narration/request-1/chapter.pcm",
                content=b"b",
                checksum="2" * 64,
                mime_type="audio/L16",
            )
        )
