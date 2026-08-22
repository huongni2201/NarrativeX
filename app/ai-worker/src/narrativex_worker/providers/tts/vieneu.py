"""VieNeu-TTS adapter for the provider-neutral narration port."""

import asyncio
import logging
from pathlib import Path
from typing import Any

import numpy as np

from narrativex_worker.config import WorkerSettings
from narrativex_worker.narration.models import SynthesizedSegment
from narrativex_worker.narration.providers import (
    TtsProviderRejectedError,
    TtsProviderUnknownError,
    TtsRequest,
)


class VieneuTtsProvider:
    """Synthesize narration with a locally hosted VieNeu-TTS engine.

    The vendor SDK is intentionally imported lazily so the worker can remain in its
    safe ``disabled`` mode without loading model/runtime dependencies.
    """

    def __init__(self, settings: WorkerSettings, *, client: Any | None = None) -> None:
        self.settings = settings
        self.logger = logging.getLogger("narrativex.worker.narration.vieneu")
        self.voice_name = settings.vieneu_voice_name
        self.voice_catalog_id = settings.vieneu_voice_id

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
            )
        else:
            self._client = client
        self._ensure_configured_voice()

    @property
    def provider_key(self) -> str:
        return "vieneu-v3turbo"

    async def synthesize(self, request: TtsRequest) -> SynthesizedSegment:
        if abs(request.speaking_rate - 1.0) > 1e-6:
            raise TtsProviderRejectedError(
                "VieNeu-TTS v3 Turbo does not expose speaking_rate; use 1.0 for this provider"
            )

        if request.reference_audio_path is not None:
            if request.voice_id != self.voice_catalog_id:
                raise TtsProviderRejectedError(
                    "Uploaded voice references require the configured VieNeu voice catalog entry"
                )
            voice_name = self.voice_name
        else:
            voice_name = self._resolve_voice(request.voice_id)
        try:
            pcm_bytes, sample_rate_hz, channels = await asyncio.to_thread(
                self._synthesize_sync,
                request.segment.text,
                voice_name,
                request.reference_audio_path,
            )
        except TtsProviderRejectedError:
            raise
        except (OSError, TimeoutError) as exception:
            raise TtsProviderUnknownError(
                "VieNeu-TTS local synthesis encountered a transient runtime error"
            ) from exception
        except Exception as exception:
            raise TtsProviderRejectedError("VieNeu-TTS synthesis failed") from exception

        return SynthesizedSegment(
            segment=request.segment,
            pcm_bytes=pcm_bytes,
            sample_rate_hz=sample_rate_hz,
            channels=channels,
        )

    def _ensure_configured_voice(self) -> None:
        available = self._available_voice_names()
        if self.voice_name in available:
            self.logger.info(
                "Using available VieNeu voice profile name=%s",
                self.voice_name,
            )
            return

        reference_path_value = self.settings.vieneu_reference_audio_path
        if not reference_path_value:
            self.logger.info(
                "No static VieNeu voice profile configured; per-request references remain available"
            )
            return
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
            "Registered VieNeu voice profile name=%s reference=%s",
            self.voice_name,
            reference_path,
        )

    def _available_voice_names(self) -> set[str]:
        return {str(item[1]) for item in self._client.list_preset_voices()}

    def _resolve_voice(self, requested_voice_id: str) -> str:
        available = self._available_voice_names()
        if requested_voice_id == self.voice_catalog_id:
            return self.voice_name
        if requested_voice_id in available:
            return requested_voice_id

        req_clean = requested_voice_id.removeprefix("vieneu-").replace("-", " ").strip().lower()
        for name in available:
            name_clean = name.strip().lower()
            if name_clean == req_clean or name_clean == requested_voice_id.strip().lower():
                return name
            if name_clean.replace(" ", "") == req_clean.replace(" ", ""):
                return name

        raise TtsProviderRejectedError(
            f"VieNeu voice {requested_voice_id!r} is not available in the worker profile"
        )

    def _synthesize_sync(
        self, text: str, voice_name: str, reference_audio_path: Path | None
    ) -> tuple[bytes, int, int]:
        sample_rate_hz = int(getattr(self._client, "sample_rate", 48_000))
        if sample_rate_hz != 48_000:
            raise TtsProviderRejectedError(
                f"VieNeu returned unsupported sample rate {sample_rate_hz}Hz"
            )

        try:
            if reference_audio_path is not None:
                audio = self._client.infer(
                    text=text,
                    ref_audio=reference_audio_path,
                    apply_watermark=self.settings.vieneu_apply_watermark,
                )
            else:
                audio = self._client.infer(
                    text=text,
                    voice=voice_name,
                    apply_watermark=self.settings.vieneu_apply_watermark,
                )
        except (ValueError, TypeError) as exception:
            raise TtsProviderRejectedError("VieNeu rejected the narration input") from exception

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
        return pcm.tobytes(), sample_rate_hz, 1
