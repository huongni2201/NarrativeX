import asyncio
import base64
import io
import wave

import google.auth
import httpx
from google.auth.credentials import Credentials
from google.auth.transport.requests import Request as GoogleAuthRequest

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.models import SynthesizedSegment
from narrativex_worker.narration.providers import (
    TtsProviderRejectedError,
    TtsProviderUnknownError,
    TtsRequest,
)


class GoogleCloudTtsProvider:
    def __init__(self, settings: WorkerSettings) -> None:
        self.settings = settings
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        self._credentials: Credentials = credentials

    @property
    def provider_key(self) -> str:
        return "google-cloud-tts"

    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment:
        token = await asyncio.to_thread(self._access_token)
        payload = {
            "input": {"text": request.segment.text},
            "voice": {"languageCode": request.language, "name": request.voice_id},
            "audioConfig": {
                "audioEncoding": "LINEAR16",
                "speakingRate": request.speaking_rate,
                "sampleRateHertz": request.sample_rate_hz,
            },
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "x-goog-user-project": str(self.settings.google_tts_project_id),
        }
        try:
            timeout = self.settings.google_tts_timeout_seconds
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self.settings.google_tts_endpoint.rstrip("/") + "/v1/text:synthesize",
                    json=payload,
                    headers=headers,
                )
        except (httpx.TimeoutException, httpx.NetworkError) as exception:
            raise TtsProviderUnknownError("Google TTS submission outcome is unknown") from exception

        if 400 <= response.status_code < 500:
            raise TtsProviderRejectedError(
                f"Google TTS rejected synthesis with HTTP {response.status_code}"
            )
        if response.status_code >= 500:
            raise TtsProviderUnknownError(
                f"Google TTS returned ambiguous HTTP {response.status_code}"
            )

        try:
            encoded = response.json()["audioContent"]
            wav_bytes = base64.b64decode(encoded, validate=True)
            with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
                if wav_file.getsampwidth() != 2:
                    raise ValueError("Google TTS LINEAR16 must be 16-bit PCM")
                if wav_file.getframerate() != request.sample_rate_hz:
                    raise ValueError("Google TTS returned an unexpected sample rate")
                if wav_file.getnchannels() != request.channels:
                    raise ValueError("Google TTS returned an unexpected channel count")
                pcm_bytes = wav_file.readframes(wav_file.getnframes())
        except (KeyError, ValueError, wave.Error) as exception:
            raise TtsProviderUnknownError("Google TTS returned invalid audio") from exception

        return SynthesizedSegment(
            segment=request.segment,
            pcm_bytes=pcm_bytes,
            sample_rate_hz=request.sample_rate_hz,
            channels=request.channels,
        )

    def _access_token(self) -> str:
        if not self._credentials.valid or not self._credentials.token:
            self._credentials.refresh(GoogleAuthRequest())  # type: ignore[no-untyped-call]
        if not self._credentials.token:
            raise RuntimeError("Google ADC did not provide an access token")
        return str(self._credentials.token)
