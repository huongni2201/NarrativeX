from __future__ import annotations

import asyncio
import io
import time
import wave

from narrativex_gpu_worker.application.errors import (
    AmbiguousOutcomeError,
    ExecutionCanceledError,
)
from narrativex_gpu_worker.application.ports.artifacts import ArtifactPort
from narrativex_gpu_worker.application.ports.execution import ExecutionContext, ExecutionOutput
from narrativex_gpu_worker.application.ports.residency import RuntimeFamily, RuntimeRequirement
from narrativex_gpu_worker.contracts import (
    AudioSynthesizeInputs,
    ComputeTask,
    ExecutionMetrics,
    ModelRef,
    ProducedArtifact,
)

from .client import VieNeuClient


def normalize_to_wav_48k_mono(raw_wav: bytes) -> bytes:
    """Ensure audio bytes are valid WAV 48kHz mono signed 16-bit PCM."""
    if not raw_wav or len(raw_wav) < 44:
        return raw_wav
    try:
        with wave.open(io.BytesIO(raw_wav), "rb") as wf:
            channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            framerate = wf.getframerate()
        if channels == 1 and sample_width == 2 and framerate == 48000:
            return raw_wav
    except Exception:
        return raw_wav

    try:
        import importlib

        torch = importlib.import_module("torch")
        torchaudio = importlib.import_module("torchaudio")

        waveform, sr = torchaudio.load(io.BytesIO(raw_wav))
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        if sr != 48000:
            resampler = torchaudio.transforms.Resample(sr, 48000)
            waveform = resampler(waveform)
        out_buf = io.BytesIO()
        torchaudio.save(
            out_buf,
            waveform,
            48000,
            format="wav",
            encoding="PCM_S",
            bits_per_sample=16,
        )
        return out_buf.getvalue()
    except Exception:
        return raw_wav


class VieNeuExecutor:
    """Executor adapter for VieNeu Vietnamese audio synthesis."""

    name = "vieneu"
    task_types = frozenset({"audio.synthesize"})
    models = (
        ModelRef(executor="vieneu", model="vieneu-v3-turbo", revision="default"),
    )

    def __init__(
        self,
        client: VieNeuClient,
        artifact_adapter: ArtifactPort,
        ready: bool = False,
    ) -> None:
        self._client = client
        self._artifact_adapter = artifact_adapter
        self._ready = ready

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def runtime_requirement(self) -> RuntimeRequirement:
        return RuntimeRequirement(
            family=RuntimeFamily.VIENEU, vram_budget_mb=4096, exclusive=False
        )

    async def execute(
        self,
        task: ComputeTask,
        cancel: asyncio.Event,
        context: ExecutionContext | None = None,
    ) -> ExecutionOutput:
        if cancel.is_set():
            raise ExecutionCanceledError("VieNeu execution canceled before submit")

        if context and context.existing_execution_handle:
            raise AmbiguousOutcomeError(
                "VieNeu does not support resuming from execution handle without "
                "lookup/dedup capability"
            )

        if context and context.save_submitting:
            await context.save_submitting()

        start_time = time.perf_counter()
        inputs = task.inputs
        assert isinstance(inputs, AudioSynthesizeInputs)

        if inputs.voice.kind == "artifact":
            ref_artifact = next(
                (a for a in task.artifacts.inputs if a.role == inputs.voice.value),
                None,
            )
            if ref_artifact is None:
                raise ValueError(f"Reference audio artifact not found: {inputs.voice.value}")
            ref_bytes = await self._artifact_adapter.download(ref_artifact)
            if cancel.is_set():
                raise ExecutionCanceledError("VieNeu execution canceled before synthesis")
            raw_wav = await self._client.synthesize_reference(
                text=inputs.script,
                reference_wav=ref_bytes,
                voice="vieneu-clone",
                cancel=cancel,
            )
        else:
            raw_wav = await self._client.synthesize(
                text=inputs.script,
                voice=inputs.voice.value,
                cancel=cancel,
            )

        if cancel.is_set():
            raise ExecutionCanceledError("VieNeu execution canceled before artifact upload")

        normalized_wav = normalize_to_wav_48k_mono(raw_wav)

        runtime_ms = int((time.perf_counter() - start_time) * 1000)
        outputs: list[ProducedArtifact] = []

        if task.artifacts.outputs:
            if cancel.is_set():
                raise ExecutionCanceledError(
                    "VieNeu execution canceled before artifact upload"
                )
            target = task.artifacts.outputs[0]
            produced = await self._artifact_adapter.upload(target, normalized_wav)
            outputs.append(produced)

        return ExecutionOutput(
            outputs=outputs,
            metrics=ExecutionMetrics(runtime_ms=runtime_ms),
            execution_handle=None,
        )


__all__ = ["VieNeuExecutor", "normalize_to_wav_48k_mono"]
