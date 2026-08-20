import asyncio

import pytest

from narrativex_worker.narration.alignment import NarrationAlignmentValidator
from narrativex_worker.narration.models import AlignmentSpan
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


def test_alignment_validator_rejects_overlap() -> None:
    validator = NarrationAlignmentValidator()
    with pytest.raises(ValueError, match="audio spans overlap"):
        validator.validate(
            [
                AlignmentSpan(0, 0, 5, 0, 1000),
                AlignmentSpan(1, 5, 10, 900, 1800),
            ],
            source_utf16_length=10,
            audio_duration_ms=1800,
        )


def test_alignment_validator_rejects_duration_drift() -> None:
    validator = NarrationAlignmentValidator(duration_tolerance_ms=250)
    with pytest.raises(ValueError, match="duration drift"):
        validator.validate(
            [AlignmentSpan(0, 0, 10, 0, 1000)],
            source_utf16_length=10,
            audio_duration_ms=1400,
        )


def test_full_chapter_fake_tts_acceptance() -> None:
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
    assert result.alignment[-1].audio_end_ms == result.duration_ms
    assert result.alignment[-1].text_end == utf16_length(source)
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
