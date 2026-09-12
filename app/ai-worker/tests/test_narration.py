import asyncio
import re

import pytest

import narrativex_worker.narration.alignment as alignment_module
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


def test_default_segmenter_preserves_sentence_boundaries_for_alignment() -> None:
    text = "Câu thứ nhất. Câu thứ hai. Câu thứ ba."
    segments = NarrationSegmenter().segment(text)

    assert [segment.text.strip() for segment in segments] == [
        "Câu thứ nhất.",
        "Câu thứ hai.",
        "Câu thứ ba.",
    ]
    assert "".join(segment.text for segment in segments) == text


def test_default_segmenter_caps_long_alignment_segments_to_subtitle_cue_size() -> None:
    text = (
        "Người đàn ông bước chậm qua hành lang tối rồi dừng trước cửa, nhưng bên trong căn "
        "phòng vẫn hoàn toàn im lặng như chưa từng có ai ở đó."
    )
    segments = NarrationSegmenter().segment(text)

    assert len(segments) >= 2
    assert all(len(segment.text) <= 96 for segment in segments)
    assert "".join(segment.text for segment in segments) == text


def test_default_segmenter_uses_newlines_as_alignment_boundaries() -> None:
    text = "Anh nhìn sang bên trái\nCô vẫn đứng yên\nKhông ai nói gì"
    segments = NarrationSegmenter().segment(text)

    assert [segment.text.strip() for segment in segments] == [
        "Anh nhìn sang bên trái",
        "Cô vẫn đứng yên",
        "Không ai nói gì",
    ]
    assert "".join(segment.text for segment in segments) == text


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


def test_alignment_validator_allows_trailing_silence() -> None:
    NarrationAlignmentValidator().validate(
        [WordAlignment(0, 0, 3, 120, 640, 0.95)],
        source_utf16_length=3,
        audio_duration_ms=1400,
    )


class _FakeWordAligner:
    def align_segments(self, segments):  # type: ignore[no-untyped-def]
        words: list[WordAlignment] = []
        audio_cursor_ms = 0
        for item in segments:
            matches = list(re.finditer(r"\S+", item.segment.text))
            duration_ms = item.duration_ms
            for offset, match in enumerate(matches):
                text_start = item.segment.text_start + utf16_length(item.segment.text[: match.start()])
                text_end = item.segment.text_start + utf16_length(item.segment.text[: match.end()])
                audio_start_ms = audio_cursor_ms + round(duration_ms * offset / len(matches))
                audio_end_ms = audio_cursor_ms + round(duration_ms * (offset + 1) / len(matches))
                words.append(
                    WordAlignment(
                        len(words),
                        text_start,
                        text_end,
                        audio_start_ms,
                        max(audio_start_ms + 1, audio_end_ms),
                        1.0,
                    )
                )
            audio_cursor_ms += duration_ms
        return words


def test_full_chapter_fake_tts_acceptance(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(alignment_module, "_WORD_ALIGNER", _FakeWordAligner())
    paragraph = (
        "Một câu chuyện dài bắt đầu ở đây. Nhân vật bước qua cánh cửa và nhìn ra thành phố. "
    )
    source = paragraph * 120
    service = FullChapterNarrationService(FakeTtsProvider())
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
    assert result.alignment[0].audio_start_ms == 0
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
