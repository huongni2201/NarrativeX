# NarrativeX AI Worker

## Purpose

The Python worker executes durable AI/media work authorized by the backend. It is not a public HTTP/FastAPI service.

## Current execution foundations

- Chapter analysis and continuity/storyboard materialization;
- durable ProviderOperation reconciliation;
- full-chapter TTS narration, alignment and R2 persistence;
- user-provided narration part/timeline processing foundation;
- Wan-compatible I2V adapter/planning foundation;
- bounded PostgreSQL claim/lease/heartbeat runtime.

## Narration

```text
TTS
  -> synthesize/assemble -> R2 -> alignment

USER_PROVIDED_AUDIO
  -> ordered parts -> logical global audio clock -> alignment
  -> no TTS_GENERATE stage
```

### VieNeu-TTS voice cloning

Install the worker dependencies, prepare a clean 3–8 second `.wav` sample outside the repository,
then configure:

```text
TTS_PROVIDER_MODE=vieneu
MEDIA_STORAGE_MODE=r2
VIENEU_REFERENCE_AUDIO_PATH=/runtime/voice/ngoc_huyen_sample.wav
VIENEU_VOICE_ID=vieneu-ngoc-huyen-v2
VIENEU_VOICE_NAME=Ngọc Huyền v2
```

The worker enrolls the profile once with `add_voice(..., denoise=True)`, calls `save_voices()`, and
reuses it for each narration segment. `VIENEU_BACKEND=auto` selects the v3 Turbo ONNX CPU path on
CPU; set `VIENEU_BACKEND=pytorch` only when the runtime has the corresponding GPU stack. The sample
is never copied into a durable job payload. Real-person samples require explicit consent.

The narration UI can also attach a user-owned MP3 reference to a VieNeu narration request. The
worker downloads that READY audio asset into the ephemeral job directory, validates the 3–8 second
rule, runs `pydub.AudioSegment.from_mp3(...).set_channels(1).export(..., format="wav")`, and passes
the temporary WAV through `ref_audio`. This per-request path does not modify the shared persisted
voice profile. The worker image includes FFmpeg for MP3 decoding.

One audio part may cover multiple Chapters. The worker can translate per-part timestamps into one global audio timeline; physical concatenation is not required just to define timeline continuity.

Production upload/finalize and real alignment runtime still need end-to-end hardening.

## Durable media

Cloudflare R2 is the only durable media store. Worker-local files are scratch/cache/FFmpeg workspace only. A retry should reuse valid R2 media rather than regenerate due solely to lost scratch.

## Worker authority boundary

The worker may validate/reconcile/retry/fallback only within persisted backend authorization. It must not decide product entitlement, create arbitrary paid work or silently upgrade an IMAGE_MOTION plan to I2V.

## Quality gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
```
