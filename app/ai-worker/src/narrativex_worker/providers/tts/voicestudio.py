"""VoiceStudio HTTP adapter for production Vietnamese narration."""

from __future__ import annotations

import asyncio
import io
import logging
import re
import wave
from pathlib import Path

import httpx

from narrativex_worker.config import WorkerSettings
from narrativex_worker.gpu_ownership import GpuOwner, gpu_lease
from narrativex_worker.narration.models import SynthesizedSegment
from narrativex_worker.narration.providers import (
    TtsExecutionSemantics,
    TtsProviderCapabilities,
    TtsProviderRejectedError,
    TtsRequest,
)


class VoiceStudioTtsEngine:
    """Call one persistent VoiceStudio service; NarrativeX never loads a TTS model."""

    def __init__(
        self,
        settings: WorkerSettings,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings
        self.logger = logging.getLogger("narrativex.worker.narration.voicestudio")
        self._inference_gate = asyncio.Semaphore(settings.voicestudio_inference_concurrency)
        self._temporary_references: dict[str, Path] = {}
        self._owns_client = client is None
        headers: dict[str, str] = {"Accept": "audio/wav"}
        if settings.voicestudio_api_key is not None:
            token = settings.voicestudio_api_key.get_secret_value().strip()
            if token:
                headers["Authorization"] = f"Bearer {token}"
        self._request_headers = headers
        self._client = client or httpx.AsyncClient(
            base_url=settings.voicestudio_base_url,
            headers=headers,
            timeout=httpx.Timeout(
                connect=10.0,
                write=60.0,
                read=settings.voicestudio_timeout_seconds,
                pool=10.0,
            ),
            follow_redirects=False,
        )

    @property
    def provider_key(self) -> str:
        model = re.sub(r"[^a-z0-9._-]+", "-", self.settings.voicestudio_model.casefold())
        return f"voicestudio-{model}"

    @property
    def capabilities(self) -> TtsProviderCapabilities:
        return TtsProviderCapabilities(
            supports_batch=False,
            supports_speaking_rate=True,
            supports_voice_reference=True,
            execution_semantics=TtsExecutionSemantics.LOCAL_RETRYABLE,
        )

    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment:
        self._validate_request(request)
        reference = request.reference_audio_path or self._temporary_references.get(request.voice_id)
        started = asyncio.get_running_loop().time()
        async with self._inference_gate:
            async with gpu_lease(self.settings, GpuOwner.VOICESTUDIO):
                response = await self._request_audio(request, reference)
        pcm = await self._wav_to_pcm(response.content)
        self.logger.info(
            "VoiceStudio synthesis completed request=%s segment=%s durationSeconds=%.3f",
            request.request_id,
            request.segment.index,
            asyncio.get_running_loop().time() - started,
        )
        return SynthesizedSegment(
            segment=request.segment,
            pcm_bytes=pcm,
            sample_rate_hz=48_000,
            channels=1,
        )

    async def synthesize_batch(self, requests: list[TtsRequest]) -> list[SynthesizedSegment]:
        # VoiceStudio's stable public contract is segment-oriented. Sequential calls reuse the
        # service's warm singleton while avoiding a request fan-out that exceeds an 8 GB GPU.
        return [await self.synthesize(request) for request in requests]

    async def enroll_reference_voice(self, request_id: str, reference_audio_path: Path) -> str:
        if not reference_audio_path.is_file():
            raise TtsProviderRejectedError("VoiceStudio reference audio does not exist")
        if reference_audio_path.suffix.casefold() != ".wav":
            raise TtsProviderRejectedError("VoiceStudio reference audio must be a WAV file")
        safe_request = re.sub(r"[^A-Za-z0-9_-]", "-", request_id)[-80:]
        temporary_voice = f"__narrativex-{safe_request}"
        self._temporary_references[temporary_voice] = reference_audio_path
        return temporary_voice

    async def release_reference_voice(self, voice_id: str) -> None:
        self._temporary_references.pop(voice_id, None)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def _request_audio(
        self,
        request: TtsRequest,
        reference_audio_path: Path | None,
    ) -> httpx.Response:
        language = request.language.split("-", 1)[0].strip().casefold() or None
        try:
            if reference_audio_path is None:
                voice = (
                    self.settings.voicestudio_voice_profile_id
                    if request.voice_id == self.settings.voicestudio_voice_id
                    else request.voice_id
                )
                response = await self._client.post(
                    "/v1/audio/speech",
                    headers=self._request_headers,
                    json={
                        "model": self.settings.voicestudio_model,
                        "voice": voice,
                        "input": request.segment.text,
                        "response_format": "wav",
                        "speed": request.speaking_rate,
                        "language": language,
                    },
                )
            else:
                response = await self._client.post(
                    "/generate",
                    headers=self._request_headers,
                    data={
                        "text": request.segment.text,
                        "language": language or "auto",
                        "speed": str(request.speaking_rate),
                        "engine": self.settings.voicestudio_model,
                        "stream": "false",
                    },
                    files={
                        "ref_audio": (
                            reference_audio_path.name,
                            reference_audio_path.read_bytes(),
                            "audio/wav",
                        )
                    },
                )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise RuntimeError(
                f"VoiceStudio request failed: {type(exception).__name__}"
            ) from exception

        if response.status_code in {400, 404, 422}:
            raise TtsProviderRejectedError(
                f"VoiceStudio rejected the narration request with HTTP {response.status_code}"
            )
        if response.status_code >= 500 or response.status_code in {408, 409, 425, 429}:
            raise RuntimeError(
                f"VoiceStudio is temporarily unavailable (HTTP {response.status_code})"
            )
        if response.is_error:
            raise TtsProviderRejectedError(
                f"VoiceStudio rejected the narration request with HTTP {response.status_code}"
            )
        if not response.content:
            raise RuntimeError("VoiceStudio returned empty audio")
        return response

    def _validate_request(self, request: TtsRequest) -> None:
        if not request.segment.text.strip():
            raise TtsProviderRejectedError("VoiceStudio narration text must not be blank")
        if len(request.segment.text) > 4096:
            raise TtsProviderRejectedError("VoiceStudio narration segment exceeds 4096 characters")
        if not 0.25 <= request.speaking_rate <= 4.0:
            raise TtsProviderRejectedError(
                "VoiceStudio speaking rate must be between 0.25 and 4.0"
            )

    @staticmethod
    async def _wav_to_pcm(wav_bytes: bytes) -> bytes:
        try:
            with wave.open(io.BytesIO(wav_bytes), "rb") as source:
                if (
                    source.getnchannels() == 1
                    and source.getsampwidth() == 2
                    and source.getframerate() == 48_000
                    and source.getcomptype() == "NONE"
                ):
                    pcm = source.readframes(source.getnframes())
                    if pcm:
                        return pcm
        except (EOFError, wave.Error):
            pass

        process = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "wav",
            "-i",
            "pipe:0",
            "-ar",
            "48000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            "-f",
            "s16le",
            "pipe:1",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            output, stderr = await process.communicate(wav_bytes)
        except asyncio.CancelledError:
            process.kill()
            await process.wait()
            raise
        if process.returncode != 0:
            message = stderr.decode("utf-8", errors="replace")[:1000]
            raise RuntimeError(f"VoiceStudio WAV normalization failed: {message}")
        if not output or len(output) % 2:
            raise RuntimeError("VoiceStudio returned invalid WAV audio")
        return output


__all__ = ["VoiceStudioTtsEngine"]
