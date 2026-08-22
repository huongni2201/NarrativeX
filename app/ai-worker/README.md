# NarrativeX AI Worker

## Purpose

The Python worker executes durable AI/media work authorized by the backend. It is not a public HTTP/FastAPI service.

## Current execution foundations

- Chapter analysis and continuity/storyboard materialization;
- durable ProviderOperation reconciliation;
- Gemini 2.5 Flash Image batch-only generation through Vertex Batch inference;
- full-chapter TTS narration, alignment and R2 persistence;
- user-provided narration part/timeline processing foundation;
- Wan-compatible I2V adapter/planning foundation;
- bounded PostgreSQL claim/lease/heartbeat runtime.

## Image generation

All enabled Gemini 2.5 Flash Image generation uses Vertex Batch inference, including a single image:

```text
VisualBeat image request(s)
  -> provider reservation/submission fence
  -> JSONL staging in GCS (one line is valid for a singleton)
  -> Vertex BatchPredictionJob
  -> persist provider job name
  -> durable reconciliation
  -> validate image bytes
  -> normal MediaAsset/R2 materialization
```

`ImageGenerationRunner` depends on a batch-capable provider and calls `submit_batch` / `reconcile_batch`.
It does not use online `submit` for the normal image path. A non-terminal submission becomes a
pending durable operation rather than an in-process polling loop, so the Vertex job can be reconciled
after worker restart.

`gemini-2.5-flash-image` supports Vertex Batch inference but not Flex PayGo. Keep
`VERTEX_IMAGE_SERVICE_TIER=standard` and `VERTEX_IMAGE_EXECUTION_MODE=batch`. The execution mode
is intentionally batch-only; `online` and `auto` are not valid production configuration values.
Enabling `IMAGE_PROVIDER_MODE=vertex` requires a configured `VERTEX_IMAGE_BATCH_GCS_BUCKET`.

The staging bucket is not a product media store. Configure a GCS lifecycle rule to remove staging
input/output after the reconciliation retention window. Cloudflare R2 remains authoritative for
final generated media.

A paid batch must never be submitted before the durable provider-operation fence is persisted.
Ambiguous submission outcomes remain `UNKNOWN` and must reconcile instead of being blindly retried.

The repository does not yet run a dedicated `SHOT_IMAGE_GENERATE` claim loop from `__main__.py`;
the batch-only runner is the execution primitive that the durable media-job worker must invoke when
that worker loop is wired.

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
VIENEU_REFERENCE_AUDIO_PATH=/run/narrativex/voices/ngoc_huyen_sample.wav
VIENEU_VOICE_ID=vieneu-ngoc-huyen-v2
VIENEU_VOICE_NAME=Ngọc Huyền v2
```

For Docker Compose, set `VIENEU_REFERENCE_AUDIO_HOST_DIR` to the host directory containing the WAV;
Compose mounts that directory read-only at `/run/narrativex/voices` inside the worker. The worker
enrolls the profile once with `add_voice(..., denoise=True)`, calls `save_voices()`, and
reuses it for each narration segment. `VIENEU_BACKEND=auto` selects the v3 Turbo ONNX CPU path on
CPU; set `VIENEU_BACKEND=pytorch` only when the runtime has the corresponding GPU stack. The worker
can enroll references through the ONNX/CPU path without importing PyTorch or TorchAudio. The sample
is never copied into a durable job payload. Real-person samples require explicit consent.

The worker image runs as non-root `appuser` with a writable `/home/appuser` runtime home. VieNeu
3.3's ONNX/CPU voice-cloning path can run without PyTorch/TorchAudio; the worker still declares
those packages for compatibility with the existing runtime and tests. VieNeu's model and profile
caches are stored under `/home/appuser/.cache/huggingface`; this avoids the `/nonexistent` home
assigned by default to Debian system users.

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
