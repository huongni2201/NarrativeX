from __future__ import annotations

import httpx


class VoiceStudioClientError(RuntimeError):
    """VoiceStudio HTTP API client error."""


class VoiceStudioClient:
    """HTTP client for VoiceStudio TTS API."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8000",
        api_key: str | None = None,
        timeout: float = 60.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._client = client

    async def synthesize(
        self,
        text: str,
        voice: str,
        model: str = "vi-profile",
        language: str | None = None,
        speed: float = 1.0,
    ) -> bytes:
        headers = {"Accept": "audio/wav"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": model,
            "voice": voice,
            "input": text,
            "response_format": "wav",
            "speed": speed,
            "language": language,
        }

        if self._client is not None:
            response = await self._client.post(
                f"{self.base_url}/v1/audio/speech",
                headers=headers,
                json=payload,
                timeout=self.timeout,
            )
        else:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/v1/audio/speech",
                    headers=headers,
                    json=payload,
                )

        if response.is_error:
            raise VoiceStudioClientError(
                f"VoiceStudio synthesis failed with status {response.status_code}"
            )
        return response.content

    async def synthesize_reference(
        self,
        text: str,
        reference_wav: bytes,
        model: str = "vi-profile",
        language: str | None = None,
        speed: float = 1.0,
    ) -> bytes:
        headers = {"Accept": "audio/wav"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        data = {
            "text": text,
            "language": language or "auto",
            "speed": str(speed),
            "engine": model,
            "stream": "false",
        }
        files = {"ref_audio": ("ref.wav", reference_wav, "audio/wav")}

        if self._client is not None:
            response = await self._client.post(
                f"{self.base_url}/generate",
                headers=headers,
                data=data,
                files=files,
                timeout=self.timeout,
            )
        else:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/generate",
                    headers=headers,
                    data=data,
                    files=files,
                )

        if response.is_error:
            raise VoiceStudioClientError(
                f"VoiceStudio reference synthesis failed with status {response.status_code}"
            )
        return response.content


__all__ = ["VoiceStudioClient", "VoiceStudioClientError"]
