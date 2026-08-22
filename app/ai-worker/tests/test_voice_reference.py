import sys
from pathlib import Path
from types import ModuleType

import pytest

from narrativex_worker.narration.voice_reference import (
    VoiceReferenceAudioError,
    prepare_mp3_reference,
)


class FakeAudioSegment:
    duration_ms = 6_000
    export_calls: list[tuple[str, str]] = []
    channel_calls = 0

    @classmethod
    def from_mp3(cls, path: str) -> "FakeAudioSegment":
        assert path.endswith("input.mp3")
        return cls()

    def __len__(self) -> int:
        return self.duration_ms

    def __getitem__(self, item: slice) -> "FakeAudioSegment":
        assert item.start is None
        assert item.stop == 8_000
        return self

    def set_channels(self, channels: int) -> "FakeAudioSegment":
        type(self).channel_calls = channels
        return self

    def export(self, path: str, *, format: str) -> None:
        type(self).export_calls.append((path, format))
        Path(path).write_bytes(b"wav")


def install_fake_pydub(monkeypatch: pytest.MonkeyPatch) -> None:
    module = ModuleType("pydub")
    module.AudioSegment = FakeAudioSegment  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "pydub", module)


def test_prepare_mp3_reference_converts_to_mono_wav(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    install_fake_pydub(monkeypatch)
    source = tmp_path / "input.mp3"
    destination = tmp_path / "ngoc-huyen.wav"
    source.write_bytes(b"mp3")

    duration = prepare_mp3_reference(source, destination)

    assert duration == 6_000
    assert FakeAudioSegment.channel_calls == 1
    assert FakeAudioSegment.export_calls[-1] == (str(destination), "wav")
    assert destination.read_bytes() == b"wav"


def test_prepare_mp3_reference_rejects_short_sample(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    install_fake_pydub(monkeypatch)
    FakeAudioSegment.duration_ms = 2_999
    source = tmp_path / "input.mp3"
    source.write_bytes(b"mp3")

    with pytest.raises(VoiceReferenceAudioError, match="at least 3 seconds"):
        prepare_mp3_reference(source, tmp_path / "ngoc-huyen.wav")

    FakeAudioSegment.duration_ms = 6_000


def test_prepare_mp3_reference_requires_mp3_extension(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    install_fake_pydub(monkeypatch)
    source = tmp_path / "input.wav"
    source.write_bytes(b"wav")

    with pytest.raises(VoiceReferenceAudioError, match=r"\.mp3"):
        prepare_mp3_reference(source, tmp_path / "output.wav")
