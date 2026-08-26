import asyncio
import wave
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.models import NarrationSegment, SynthesizedSegment
from narrativex_worker.narration.providers import TtsRequest
from narrativex_worker.providers.tts.vieneu import VieneuTtsProvider


class FakeVieneuClient:
    sample_rate = 48_000

    def __init__(self) -> None:
        self.voices: set[str] = set()
        self.add_voice_calls: list[tuple[str, Path, bool, bool]] = []
        self.remove_voice_calls: list[str] = []
        self.save_calls = 0
        self.batch_calls: list[tuple[list[str], str | None, int, bool]] = []

    def list_preset_voices(self) -> list[tuple[str, str]]:
        return [(name, name) for name in sorted(self.voices)]

    def add_voice(self, name: str, path: Path, *, denoise: bool, save: bool = False) -> None:
        self.add_voice_calls.append((name, path, denoise, save))
        self.voices.add(name)

    def remove_voice(self, name: str, save: bool = False) -> None:
        del save
        self.remove_voice_calls.append(name)
        self.voices.discard(name)

    def save_voices(self) -> None:
        self.save_calls += 1

    def infer_batch(
        self,
        texts: list[str],
        *,
        voice: str | None = None,
        batch_size: int,
        apply_watermark: bool,
    ) -> list[np.ndarray]:
        self.batch_calls.append((texts, voice, batch_size, apply_watermark))
        return [np.array([[-1.0, -0.25, 0.25, 1.0]], dtype=np.float32) for _ in texts]


def _request(*, speaking_rate: float = 1.0, index: int = 0) -> TtsRequest:
    return TtsRequest(
        request_id=f"req-{index}",
        segment=NarrationSegment(index=index, text_start=0, text_end=5, text="Xin chào"),
        voice_id="vieneu-ngoc-huyen-v2",
        language="vi-VN",
        speaking_rate=speaking_rate,
    )


def test_vieneu_enrolls_static_reference_without_writing_site_packages(tmp_path: Path) -> None:
    reference = tmp_path / "ngoc_huyen_sample.wav"
    reference.write_bytes(b"test audio placeholder")
    client = FakeVieneuClient()
    settings = WorkerSettings(worker_env="test", vieneu_reference_audio_path=str(reference))

    provider = VieneuTtsProvider(settings, client=client)
    result = asyncio.run(provider.synthesize(_request()))

    assert client.add_voice_calls == [("Ngọc Huyền v2", reference, True, False)]
    assert client.save_calls == 0
    assert client.batch_calls == [(["Xin chào"], "Ngọc Huyền v2", 32, False)]
    assert result.sample_rate_hz == 48_000
    assert result.channels == 1
    assert result.pcm_bytes == b"\x01\x80\x00\xe0\x00\x20\xff\x7f"


def test_vieneu_batches_multiple_segments_in_one_sdk_call(tmp_path: Path) -> None:
    reference = tmp_path / "ngoc_huyen_sample.wav"
    reference.write_bytes(b"test audio placeholder")
    client = FakeVieneuClient()
    settings = WorkerSettings(
        worker_env="test",
        vieneu_reference_audio_path=str(reference),
        vieneu_max_batch_size=16,
    )
    provider = VieneuTtsProvider(settings, client=client)

    results = asyncio.run(provider.synthesize_batch([_request(index=0), _request(index=1)]))

    assert len(results) == 2
    assert client.batch_calls == [(["Xin chào", "Xin chào"], "Ngọc Huyền v2", 16, False)]


def test_vieneu_reuses_enrolled_voice_without_reenrollment(tmp_path: Path) -> None:
    client = FakeVieneuClient()
    client.voices.add("Ngọc Huyền v2")
    settings = WorkerSettings(worker_env="test")

    VieneuTtsProvider(settings, client=client)

    assert client.add_voice_calls == []
    assert client.save_calls == 0


def test_vieneu_uses_builtin_ngoc_huyen_preset_without_reference_audio() -> None:
    client = FakeVieneuClient()
    client.voices.add("Ngọc Huyền")
    settings = WorkerSettings(
        worker_env="test",
        vieneu_voice_id="vieneu-ngoc-huyen",
        vieneu_voice_name="Ngọc Huyền",
    )

    provider = VieneuTtsProvider(settings, client=client)
    result = asyncio.run(
        provider.synthesize(
            TtsRequest(
                request_id="req-preset",
                segment=NarrationSegment(index=0, text_start=0, text_end=5, text="Xin chào"),
                voice_id="vieneu-ngoc-huyen",
                language="vi-VN",
                speaking_rate=1.0,
            )
        )
    )

    assert client.add_voice_calls == []
    assert client.batch_calls[-1][1] == "Ngọc Huyền"
    assert result.sample_rate_hz == 48_000


@pytest.mark.parametrize(
    ("voice_id", "voice_name"),
    [("vieneu-my-duyen", "Mỹ Duyên"), ("vieneu-thuy-dung", "Thùy Dung")],
)
def test_vieneu_resolves_catalog_ids_without_diacritics(voice_id: str, voice_name: str) -> None:
    client = FakeVieneuClient()
    client.voices.update({"Ngọc Huyền", voice_name})
    settings = WorkerSettings(
        worker_env="test",
        vieneu_voice_id="vieneu-ngoc-huyen",
        vieneu_voice_name="Ngọc Huyền",
    )

    provider = VieneuTtsProvider(settings, client=client)
    asyncio.run(provider.synthesize(replace(_request(), voice_id=voice_id)))

    assert client.batch_calls[-1][1] == voice_name


def test_vieneu_missing_configured_voice_fails_fast() -> None:
    with pytest.raises(RuntimeError, match="unavailable"):
        VieneuTtsProvider(WorkerSettings(worker_env="test"), client=FakeVieneuClient())


def test_vieneu_applies_non_default_speaking_rate(tmp_path: Path) -> None:
    reference = tmp_path / "ngoc_huyen_sample.wav"
    reference.write_bytes(b"test audio placeholder")
    client = FakeVieneuClient()
    settings = WorkerSettings(worker_env="test", vieneu_reference_audio_path=str(reference))
    applied_rates: list[float] = []

    async def stretch(segment: SynthesizedSegment, rate: float) -> SynthesizedSegment:
        applied_rates.append(rate)
        return SynthesizedSegment(
            segment=segment.segment,
            pcm_bytes=segment.pcm_bytes + b"\x00\x00",
            sample_rate_hz=segment.sample_rate_hz,
            channels=segment.channels,
        )

    provider = VieneuTtsProvider(settings, client=client, time_stretcher=stretch)

    result = asyncio.run(provider.synthesize(_request(speaking_rate=1.1)))

    assert provider.capabilities.supports_speaking_rate is True
    assert applied_rates == [1.1]
    assert result.pcm_bytes.endswith(b"\x00\x00")


def test_vieneu_atempo_filter_chain_covers_supported_range() -> None:
    assert VieneuTtsProvider._atempo_filters(0.25) == ("atempo=0.5", "atempo=0.5")
    assert VieneuTtsProvider._atempo_filters(0.75) == ("atempo=0.75",)
    assert VieneuTtsProvider._atempo_filters(2.0) == ("atempo=2",)

    with pytest.raises(ValueError, match="between 0.25 and 2.0"):
        VieneuTtsProvider._atempo_filters(2.1)


def test_vieneu_time_stretch_uses_pitch_preserving_ffmpeg_filter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeVieneuClient()
    client.voices.add("Ngọc Huyền v2")
    provider = VieneuTtsProvider(WorkerSettings(worker_env="test"), client=client)
    segment = SynthesizedSegment(
        segment=NarrationSegment(index=0, text_start=0, text_end=5, text="Xin chào"),
        pcm_bytes=b"\x00\x00" * 16,
        sample_rate_hz=48_000,
        channels=1,
    )
    calls: list[tuple[tuple[object, ...], dict[str, object]]] = []

    class FakeProcess:
        returncode = 0

        async def communicate(self, payload: bytes) -> tuple[bytes, bytes]:
            del payload
            return b"stretched", b""

        async def wait(self) -> None:
            return None

        def kill(self) -> None:
            return None

    process = FakeProcess()

    async def create_process(*args: object, **kwargs: object) -> FakeProcess:
        calls.append((args, kwargs))
        return process

    monkeypatch.setattr(
        "narrativex_worker.providers.tts.vieneu.asyncio.create_subprocess_exec", create_process
    )

    result = asyncio.run(provider._time_stretch(segment, 0.25))

    args, kwargs = calls[0]
    assert args[0:2] == ("ffmpeg", "-hide_banner")
    assert args[args.index("-af") + 1] == "atempo=0.5,atempo=0.5"
    assert kwargs["stdin"] is asyncio.subprocess.PIPE
    assert result.pcm_bytes == b"stretched"


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


def test_vieneu_enrolls_and_releases_per_job_reference(tmp_path: Path) -> None:
    reference = tmp_path / "request-reference.wav"
    reference.write_bytes(b"prepared wav")
    client = FakeVieneuClient()
    client.voices.add("Ngọc Huyền v2")
    provider = VieneuTtsProvider(WorkerSettings(worker_env="test"), client=client)

    temporary_voice = asyncio.run(provider.enroll_reference_voice("job:123", reference))
    request = TtsRequest(
        request_id="req-reference",
        segment=NarrationSegment(index=0, text_start=0, text_end=5, text="Xin chào"),
        voice_id=temporary_voice,
        language="vi-VN",
        speaking_rate=1.0,
    )
    asyncio.run(provider.synthesize(request))
    asyncio.run(provider.release_reference_voice(temporary_voice))

    assert temporary_voice.startswith("__narrativex-")
    assert client.add_voice_calls[-1] == (temporary_voice, reference, True, False)
    assert client.batch_calls[-1][1] == temporary_voice
    assert client.remove_voice_calls == [temporary_voice]
