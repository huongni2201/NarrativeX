"""VieNeu-TTS adapter for the provider-neutral narration port."""

import asyncio
import logging
import re
import time
import unicodedata
from pathlib import Path
from typing import Any

import numpy as np

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.models import SynthesizedSegment
from narrativex_worker.narration.providers import (
    TtsExecutionSemantics,
    TtsProviderCapabilities,
    TtsProviderRejectedError,
    TtsRequest,
)


class VieneuTtsProvider:
    """Synthesize narration with a locally hosted VieNeu-TTS v3 Turbo engine.

    The SDK is imported lazily so deployments that do not enable VieNeu do not load
    model/runtime dependencies. Local execution is deliberately retryable: there is
    no external provider side effect that requires UNKNOWN reconciliation.
    """

    def __init__(self, settings: WorkerSettings, *, client: Any | None = None) -> None:
        self.settings = settings
        self.logger = logging.getLogger("narrativex.worker.narration.vieneu")
        self.voice_name = settings.vieneu_voice_name
        self.voice_catalog_id = settings.vieneu_voice_id
        self._inference_gate = asyncio.Semaphore(settings.vieneu_inference_concurrency)

        if client is None:
            try:
                from vieneu import Vieneu  # type: ignore[import-untyped]
            except ImportError as exception:
                raise RuntimeError(
                    "TTS_PROVIDER_MODE=vieneu requires the vieneu package. "
                    "Install the AI worker dependencies with `pip install .`."
                ) from exception

            self._client = Vieneu(
                mode="v3turbo",
                backend=settings.vieneu_backend,
                precision=settings.vieneu_precision,
                threads=settings.vieneu_threads,
                max_batch_size=settings.vieneu_max_batch_size,
            )
        else:
            self._client = client
        self._ensure_configured_voice()

    @property
    def provider_key(self) -> str:
        return "vieneu-v3turbo"

    @property
    def capabilities(self) -> TtsProviderCapabilities:
        return TtsProviderCapabilities(
            supports_batch=True,
            supports_speaking_rate=False,
            supports_voice_reference=True,
            execution_semantics=TtsExecutionSemantics.LOCAL_RETRYABLE,
        )

    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment:
        results = await self.synthesize_batch([request])
        return results[0]

    async def synthesize_batch(self, requests: list[TtsRequest]) -> list[SynthesizedSegment]:
        if not requests:
            return []
        self._validate_requests(requests)
        voice_name = self._resolve_voice(requests[0].voice_id)
        texts = [request.segment.text for request in requests]
        started_at = time.monotonic()
        self.logger.info(
            "VieNeu inference started voice=%s batchCount=%s batchSize=%s",
            voice_name,
            len(requests),
            self.settings.vieneu_max_batch_size,
        )
        try:
            async with self._inference_gate:
                audios = await asyncio.to_thread(
                    self._client.infer_batch,
                    texts,
                    voice=voice_name,
                    batch_size=self.settings.vieneu_max_batch_size,
                    apply_watermark=self.settings.vieneu_apply_watermark,
                )
        except (ValueError, TypeError) as exception:
            self.logger.exception(
                "VieNeu inference rejected voice=%s batchCount=%s",
                voice_name,
                len(requests),
            )
            raise TtsProviderRejectedError("VieNeu rejected the narration input") from exception

        if len(audios) != len(requests):
            self.logger.error(
                "VieNeu inference returned incomplete batch voice=%s expected=%s actual=%s",
                voice_name,
                len(requests),
                len(audios),
            )
            raise RuntimeError(
                f"VieNeu returned {len(audios)} waveforms for {len(requests)} requests"
            )
        self.logger.info(
            "VieNeu inference completed voice=%s batchCount=%s durationSeconds=%.3f",
            voice_name,
            len(requests),
            time.monotonic() - started_at,
        )
        return [
            self._waveform_to_segment(request, audio)
            for request, audio in zip(requests, audios, strict=True)
        ]

    async def enroll_reference_voice(self, request_id: str, reference_audio_path: Path) -> str:
        if not reference_audio_path.is_file():
            raise TtsProviderRejectedError("VieNeu reference audio does not exist")
        if reference_audio_path.suffix.lower() != ".wav":
            raise TtsProviderRejectedError("VieNeu reference audio must be a WAV file")
        safe_request = re.sub(r"[^A-Za-z0-9_-]", "-", request_id)[-80:]
        temporary_voice = f"__narrativex-{safe_request}"
        try:
            async with self._inference_gate:
                await asyncio.to_thread(
                    self._client.add_voice,
                    temporary_voice,
                    reference_audio_path,
                    denoise=self.settings.vieneu_denoise_reference,
                    save=False,
                )
        except (ValueError, TypeError) as exception:
            raise TtsProviderRejectedError(
                "VieNeu rejected the uploaded voice reference"
            ) from exception
        self.logger.info("Enrolled temporary VieNeu voice name=%s", temporary_voice)
        return temporary_voice

    async def release_reference_voice(self, voice_id: str) -> None:
        if not voice_id.startswith("__narrativex-"):
            return
        try:
            async with self._inference_gate:
                await asyncio.to_thread(self._client.remove_voice, voice_id, False)
        except Exception:
            self.logger.exception("Failed to release temporary VieNeu voice name=%s", voice_id)

    def _ensure_configured_voice(self) -> None:
        available = self._available_voice_names()
        reference_path_value = self.settings.vieneu_reference_audio_path
        should_reenroll = self.settings.vieneu_force_reenroll and bool(reference_path_value)
        if self.voice_name in available and not should_reenroll:
            self.logger.info("Using available VieNeu voice profile name=%s", self.voice_name)
            return

        if not reference_path_value:
            raise RuntimeError(
                f"Configured VieNeu voice {self.voice_name!r} is unavailable and "
                "VIENEU_REFERENCE_AUDIO_PATH is not configured"
            )
        reference_path = Path(reference_path_value).expanduser()
        if not reference_path.is_file():
            raise RuntimeError(f"VieNeu reference audio does not exist: {reference_path}")
        if reference_path.suffix.lower() != ".wav":
            raise RuntimeError("VIENEU_REFERENCE_AUDIO_PATH must point to a .wav file")

        try:
            self._client.add_voice(
                self.voice_name,
                reference_path,
                denoise=self.settings.vieneu_denoise_reference,
                save=False,
            )
            if self.settings.vieneu_save_voice_profile:
                self._client.save_voices()
        except (OSError, TimeoutError) as exception:
            self.logger.exception(
                "VieNeu voice profile persistence failed name=%r reference=%s",
                self.voice_name,
                reference_path,
            )
            raise RuntimeError("VieNeu voice profile could not be persisted") from exception
        except Exception as exception:
            self.logger.exception(
                "VieNeu voice enrollment failed name=%r reference=%s",
                self.voice_name,
                reference_path,
            )
            raise RuntimeError(
                f"VieNeu voice enrollment failed for {self.voice_name!r}"
            ) from exception

        self.logger.info(
            "Registered VieNeu voice profile name=%s reference=%s persistent=%s",
            self.voice_name,
            reference_path,
            self.settings.vieneu_save_voice_profile,
        )

    def _available_voice_names(self) -> set[str]:
        return {str(item[1]) for item in self._client.list_preset_voices()}

    @staticmethod
    def _voice_lookup_key(value: str) -> str:
        without_diacritics = "".join(
            character
            for character in unicodedata.normalize("NFKD", value.casefold())
            if not unicodedata.combining(character)
        )
        normalized = without_diacritics.removeprefix("vieneu-").replace("-", " ")
        return " ".join(normalized.split())

    def _resolve_voice(self, requested_voice_id: str) -> str:
        available = self._available_voice_names()
        if requested_voice_id == self.voice_catalog_id:
            if self.voice_name not in available:
                raise TtsProviderRejectedError(
                    f"Configured VieNeu voice {self.voice_name!r} is not enrolled"
                )
            return self.voice_name
        if requested_voice_id in available:
            return requested_voice_id

        requested_key = self._voice_lookup_key(requested_voice_id)
        for name in available:
            if self._voice_lookup_key(name) == requested_key:
                return name

        raise TtsProviderRejectedError(
            f"VieNeu voice {requested_voice_id!r} is not available in the worker profile"
        )

    def _validate_requests(self, requests: list[TtsRequest]) -> None:
        first = requests[0]
        if first.reference_audio_path is not None:
            raise TtsProviderRejectedError(
                "Reference audio must be enrolled once before VieNeu batch synthesis"
            )
        for request in requests:
            if abs(request.speaking_rate - 1.0) > 1e-6:
                raise TtsProviderRejectedError(
                    "VieNeu-TTS v3 Turbo does not expose speaking_rate; use 1.0 for this provider"
                )
            if request.reference_audio_path is not None:
                raise TtsProviderRejectedError(
                    "Reference audio must be enrolled once before VieNeu batch synthesis"
                )
            if request.voice_id != first.voice_id:
                raise TtsProviderRejectedError("VieNeu batch synthesis requires one shared voice")

    def _waveform_to_segment(self, request: TtsRequest, audio: Any) -> SynthesizedSegment:
        sample_rate_hz = int(getattr(self._client, "sample_rate", 48_000))
        if sample_rate_hz != 48_000:
            raise TtsProviderRejectedError(
                f"VieNeu returned unsupported sample rate {sample_rate_hz}Hz"
            )
        waveform = np.asarray(audio, dtype=np.float32)
        if waveform.ndim == 2:
            axis = 0 if waveform.shape[0] <= 2 else 1
            waveform = waveform.mean(axis=axis)
        if waveform.ndim != 1 or waveform.size == 0:
            raise TtsProviderRejectedError("VieNeu returned an empty or non-vector waveform")
        if not np.isfinite(waveform).all():
            raise TtsProviderRejectedError("VieNeu returned a waveform containing non-finite data")

        pcm = np.clip(waveform, -1.0, 1.0)
        pcm = np.rint(pcm * 32767.0).astype("<i2", copy=False)
        return SynthesizedSegment(
            segment=request.segment,
            pcm_bytes=pcm.tobytes(),
            sample_rate_hz=sample_rate_hz,
            channels=1,
        )
