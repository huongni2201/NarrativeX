import asyncio
import wave
from pathlib import Path

import numpy as np
import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.models import NarrationSegment
from narrativex_worker.narration.providers import TtsProviderRejectedError, TtsRequest
from narrativex_worker.providers.tts.vieneu import VieneuTtsProvider


class FakeVieneuClient:
    sample_rate = 48_000

    def __init__(self) -> None:
        self.voices: set[str] = set()
        self.add_voice_calls: list[tuple[str, Path, bool]] = []
        self.save_calls = 0
        self.infer_calls: list[tuple[str, str | None, bool, Path | None]] = []

    def list_preset_voices(self) -> list[tuple[str, str]]:
        return [(name, name) for name in sorted(self.voices)]

    def add_voice(self, name: str, path: Path, *, denoise: bool) -> None:
        self.add_voice_calls.append((name, path, denoise))
        self.voices.add(name)

    def save_voices(self) -> None:
        self.save_calls += 1

    def infer(
        self,
        *,
        text: str,
        voice: str | None = None,
        ref_audio: Path | None = None,
        apply_watermark: bool,
    ) -> np.ndarray:
        self.infer_calls.append((text, voice, apply_watermark, ref_audio))
        return np.array([[-1.0, -0.25, 0.25, 1.0]], dtype=np.float32)


def _request(*, speaking_rate: float = 1.0) -> TtsRequest:
    return TtsRequest(
        request_id="req-1",
        segment=NarrationSegment(index=0, text_start=0, text_end=5, text="Xin chào"),
        voice_id="vieneu-ngoc-huyen-v2",
        language="vi-VN",
        speaking_rate=speaking_rate,
    )


def test_vieneu_enrolls_reference_and_converts_waveform_to_pcm(tmp_path: Path) -> None:
    reference = tmp_path / "ngoc_huyen_sample.wav"
    reference.write_bytes(b"test audio placeholder")
    client = FakeVieneuClient()
    settings = WorkerSettings(worker_env="test", vieneu_reference_audio_path=str(reference))

    provider = VieneuTtsProvider(settings, client=client)
    result = asyncio.run(provider.synthesize(_request()))

    assert client.add_voice_calls == [("Ngọc Huyền v2", reference, True)]
    assert client.save_calls == 1
    assert client.infer_calls == [("Xin chào", "Ngọc Huyền v2", False, None)]
    assert result.sample_rate_hz == 48_000
    assert result.channels == 1
    assert result.pcm_bytes == b"\x01\x80\x00\xe0\x00\x20\xff\x7f"


def test_vieneu_reuses_persisted_voice_without_reenrollment(tmp_path: Path) -> None:
    reference = tmp_path / "ngoc_huyen_sample.wav"
    reference.write_bytes(b"test audio placeholder")
    client = FakeVieneuClient()
    client.voices.add("Ngọc Huyền v2")
    settings = WorkerSettings(worker_env="test", vieneu_reference_audio_path=str(reference))

    VieneuTtsProvider(settings, client=client)

    assert client.add_voice_calls == []
    assert client.save_calls == 0


def test_vieneu_rejects_non_default_speaking_rate(tmp_path: Path) -> None:
    reference = tmp_path / "ngoc_huyen_sample.wav"
    reference.write_bytes(b"test audio placeholder")
    client = FakeVieneuClient()
    settings = WorkerSettings(worker_env="test", vieneu_reference_audio_path=str(reference))
    provider = VieneuTtsProvider(settings, client=client)

    with pytest.raises(TtsProviderRejectedError, match="speaking_rate"):
        asyncio.run(provider.synthesize(_request(speaking_rate=1.1)))


def test_vieneu_reference_path_must_be_wav(tmp_path: Path) -> None:
    reference = tmp_path / "sample.mp3"
    reference.write_bytes(b"test audio placeholder")
    settings = WorkerSettings(worker_env="test", vieneu_reference_audio_path=str(reference))

    with pytest.raises(RuntimeError, match="\\.wav"):
        VieneuTtsProvider(settings, client=FakeVieneuClient())


def test_vieneu_pcm_is_valid_little_endian_16_bit_mono(tmp_path: Path) -> None:
    reference = tmp_path / "ngoc_huyen_sample.wav"
    reference.write_bytes(b"test audio placeholder")
    settings = WorkerSettings(worker_env="test", vieneu_reference_audio_path=str(reference))
    result = asyncio.run(
        VieneuTtsProvider(settings, client=FakeVieneuClient()).synthesize(_request())
    )

    output = tmp_path / "segment.pcm.wav"
    with wave.open(str(output), "wb") as wav:
        wav.setnchannels(result.channels)
        wav.setsampwidth(2)
        wav.setframerate(result.sample_rate_hz)
        wav.writeframes(result.pcm_bytes)
    with wave.open(str(output), "rb") as wav:
        assert wav.getnchannels() == 1
        assert wav.getsampwidth() == 2
        assert wav.getframerate() == 48_000


def test_vieneu_uses_per_request_reference_without_persisting_shared_profile(
    tmp_path: Path,
) -> None:
    reference = tmp_path / "request-reference.wav"
    reference.write_bytes(b"prepared wav")
    client = FakeVieneuClient()
    settings = WorkerSettings(worker_env="test")
    provider = VieneuTtsProvider(settings, client=client)
    request = TtsRequest(
        request_id="req-reference",
        segment=NarrationSegment(index=0, text_start=0, text_end=5, text="Xin chào"),
        voice_id="vieneu-ngoc-huyen-v2",
        language="vi-VN",
        speaking_rate=1.0,
        reference_audio_path=reference,
    )

    asyncio.run(provider.synthesize(request))

    assert client.add_voice_calls == []
    assert client.infer_calls == [("Xin chào", None, False, reference)]
