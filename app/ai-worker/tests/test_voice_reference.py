import sys
from types import SimpleNamespace

import pytest

from narrativex_worker.narration.voice_reference import (
    VoiceReferenceAudioError,
    prepare_mp3_reference,
    prepare_voice_reference,
)


class FakeAudio:
    def __init__(self, duration_ms: int) -> None:
        self.duration_ms = duration_ms
        self.channels = 2

    def __len__(self) -> int:
        return self.duration_ms

    def __getitem__(self, item):
        stop = item.stop if isinstance(item, slice) else self.duration_ms
        return FakeAudio(min(self.duration_ms, stop or self.duration_ms))

    def set_channels(self, channels: int):
        self.channels = channels
        return self

    def export(self, destination: str, *, format: str):
        assert format == "wav"
        with open(destination, "wb") as output:
            output.write(b"RIFFfake-wave")


class FakeAudioSegment:
    next_duration_ms = 4_000
    last_format = "unset"

    @classmethod
    def from_file(cls, source: str, *, format=None):
        cls.last_format = format
        return FakeAudio(cls.next_duration_ms)


@pytest.fixture(autouse=True)
def fake_pydub(monkeypatch):
    FakeAudioSegment.next_duration_ms = 4_000
    FakeAudioSegment.last_format = "unset"
    monkeypatch.setitem(sys.modules, "pydub", SimpleNamespace(AudioSegment=FakeAudioSegment))


def test_backward_compatible_entry_point_probes_uploaded_bytes(tmp_path):
    source = tmp_path / "voice-reference.mp3"
    source.write_bytes(b"fake-wav-bytes")
    destination = tmp_path / "normalized.wav"

    duration_ms = prepare_mp3_reference(source, destination)

    assert duration_ms == 4_000
    assert FakeAudioSegment.last_format is None
    assert destination.exists()


def test_explicit_wav_content_type_is_supported_and_trimmed(tmp_path):
    FakeAudioSegment.next_duration_ms = 12_000
    source = tmp_path / "reference.wav"
    source.write_bytes(b"fake-wav-bytes")
    destination = tmp_path / "normalized.wav"

    duration_ms = prepare_voice_reference(
        source,
        destination,
        content_type="audio/wav",
    )

    assert duration_ms == 8_000
    assert FakeAudioSegment.last_format == "wav"


def test_reference_rejects_unsupported_type_and_too_short_audio(tmp_path):
    source = tmp_path / "reference.ogg"
    source.write_bytes(b"fake-audio")
    destination = tmp_path / "normalized.wav"

    with pytest.raises(VoiceReferenceAudioError, match="MP3 or WAV"):
        prepare_voice_reference(source, destination, content_type="audio/ogg")

    FakeAudioSegment.next_duration_ms = 2_999
    with pytest.raises(VoiceReferenceAudioError, match="at least 3 seconds"):
        prepare_voice_reference(source, destination, content_type="audio/wav")
