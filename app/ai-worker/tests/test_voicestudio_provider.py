from __future__ import annotations

import io
import wave
from dataclasses import replace
from pathlib import Path

import httpx
import pytest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.models import NarrationSegment
from narrativex_worker.narration.providers import TtsProviderRejectedError, TtsRequest
from narrativex_worker.providers.tts.voicestudio import VoiceStudioTtsEngine


def _wav_bytes(frames: int = 480) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(48_000)
        wav.writeframes(b"\x01\x00" * frames)
    return output.getvalue()


def _request(**changes: object) -> TtsRequest:
    request = TtsRequest(
        request_id="req-1",
        segment=NarrationSegment(index=0, text_start=0, text_end=8, text="Xin chào"),
        voice_id="voicestudio-default",
        language="vi-VN",
        speaking_rate=1.1,
    )
    return replace(request, **changes)


@pytest.mark.asyncio
async def test_voicestudio_uses_openai_compatible_wav_endpoint() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, headers={"Content-Type": "audio/wav"}, content=_wav_bytes())

    async with httpx.AsyncClient(
        base_url="http://voicestudio:3900", transport=httpx.MockTransport(handler)
    ) as client:
        engine = VoiceStudioTtsEngine(
            WorkerSettings(
                worker_env="test",
                voicestudio_api_key="secret",
                voicestudio_model="tts-1",
            ),
            client=client,
        )
        result = await engine.synthesize(_request())

    request = requests[0]
    assert request.url.path == "/v1/audio/speech"
    assert request.headers["authorization"] == "Bearer secret"
    assert request.content
    assert b'"response_format":"wav"' in request.content
    assert b'"voice":"default"' in request.content
    assert b'"language":"vi"' in request.content
    assert result.sample_rate_hz == 48_000
    assert result.channels == 1
    assert result.pcm_bytes == b"\x01\x00" * 480


@pytest.mark.asyncio
async def test_voicestudio_reference_uses_native_headless_generate_route(tmp_path: Path) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, headers={"Content-Type": "audio/wav"}, content=_wav_bytes())

    reference = tmp_path / "voice-reference.wav"
    reference.write_bytes(_wav_bytes())
    async with httpx.AsyncClient(
        base_url="http://voicestudio:3900", transport=httpx.MockTransport(handler)
    ) as client:
        engine = VoiceStudioTtsEngine(WorkerSettings(worker_env="test"), client=client)
        temporary_voice = await engine.enroll_reference_voice("job:123", reference)
        await engine.synthesize(replace(_request(), voice_id=temporary_voice))
        await engine.release_reference_voice(temporary_voice)

    request = requests[0]
    assert request.url.path == "/generate"
    assert request.headers["content-type"].startswith("multipart/form-data")
    assert b'filename="voice-reference.wav"' in request.content
    assert b'name="engine"' in request.content
    assert b"tts-1" in request.content
    assert engine._temporary_references == {}


@pytest.mark.asyncio
async def test_voicestudio_serializes_segment_requests_against_one_service() -> None:
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        del request
        call_count += 1
        return httpx.Response(200, headers={"Content-Type": "audio/wav"}, content=_wav_bytes())

    async with httpx.AsyncClient(
        base_url="http://voicestudio:3900", transport=httpx.MockTransport(handler)
    ) as client:
        engine = VoiceStudioTtsEngine(WorkerSettings(worker_env="test"), client=client)
        results = await engine.synthesize_batch(
            [_request(), _request(segment=NarrationSegment(1, 8, 16, "thế giới"))]
        )

    assert call_count == 2
    assert [item.segment.index for item in results] == [0, 1]
    assert engine.capabilities.supports_batch is False


@pytest.mark.asyncio
async def test_voicestudio_rejects_bad_input_without_calling_service() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"unexpected request: {request.url}")

    async with httpx.AsyncClient(
        base_url="http://voicestudio:3900", transport=httpx.MockTransport(handler)
    ) as client:
        engine = VoiceStudioTtsEngine(WorkerSettings(worker_env="test"), client=client)
        with pytest.raises(TtsProviderRejectedError, match="must not be blank"):
            await engine.synthesize(
                _request(segment=NarrationSegment(0, 0, 1, " "))
            )


@pytest.mark.asyncio
async def test_voicestudio_503_is_retryable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        del request
        return httpx.Response(503, json={"detail": "GPU busy"})

    async with httpx.AsyncClient(
        base_url="http://voicestudio:3900", transport=httpx.MockTransport(handler)
    ) as client:
        engine = VoiceStudioTtsEngine(WorkerSettings(worker_env="test"), client=client)
        with pytest.raises(RuntimeError, match="temporarily unavailable"):
            await engine.synthesize(_request())
