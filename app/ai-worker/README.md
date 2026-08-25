# NarrativeX AI Worker

## Purpose

The Python worker executes durable AI/media work authorized by the backend. It is not a public HTTP/FastAPI service.

## Current V1.11 execution foundations

- Chapter analysis and continuity/storyboard materialization;
- durable ProviderOperation reconciliation;
- Gemini 2.5 Flash Image batch-only generation through Vertex Batch inference;
- full-chapter TTS narration, alignment and R2 persistence;
- user-provided narration part/timeline processing foundation;
- deterministic IMAGE_MOTION FFmpeg rendering, subtitle burning, ffprobe validation and final-artifact storage adapters;
- database-backed media validation and local-device-compatible worker configuration;
- character reference-aware image requests and immutable reference snapshots;
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

The durable `SHOT_IMAGE_GENERATE` worker path is role-gated from `__main__.py`; the batch-only
runner is invoked by the image-generation role after PostgreSQL claim/lease fencing.

## Narration

```text
TTS
  -> synthesize/assemble -> R2 -> alignment

USER_PROVIDED_AUDIO
  -> ordered parts -> logical global audio clock -> alignment
  -> no TTS_GENERATE stage
```

### VieNeu-TTS voices

VieNeu v3.3.0 includes a built-in preset named `Ngọc Huyền`; it does not need a
reference audio file. NarrativeX also keeps `Ngọc Huyền v2` as a separate
system-managed reference profile, which is enrolled from `ngoc_huyen_sample.wav`
when that voice is selected.

To create browser previews for the catalog, run the checked-in generator from the
worker environment. It writes one short WAV per built-in VieNeu voice under
`app/ai-worker/artifacts/vieneu-previews/`:

```text
python app/ai-worker/scripts/generate_vieneu_previews.py \
  --output-dir app/ai-worker/artifacts/vieneu-previews \
  --skip-reference-voice
```

Upload each generated file to R2 with the key
`narration/vieneu-previews/<filename>` and save the resulting public or signed URL in
the matching `voice_catalog.sample_url`. The `Ngọc Huyền v2` file is intentionally
not generated until the consented `ngoc_huyen_sample.wav` is supplied with
`--reference-audio`.

### VieNeu-TTS voice cloning

Install the narration extra with `pip install ".[narration]"`, prepare a clean 3–8 second `.wav` sample outside the repository,
then configure:

```text
TTS_PROVIDER_MODE=vieneu
MEDIA_STORAGE_MODE=r2
VIENEU_REFERENCE_AUDIO_PATH=/run/narrativex/voices/ngoc_huyen_sample.wav
VIENEU_VOICE_ID=vieneu-ngoc-huyen-v2
VIENEU_VOICE_NAME=Ngọc Huyền v2
```

For the production Compose stack, set `VIENEU_REFERENCE_AUDIO_FILE` to the host WAV path;
Compose mounts that file read-only at `/run/narrativex/voices/reference.wav` inside the worker. The worker
enrolls the profile once with `add_voice(..., denoise=True)`, calls `save_voices()`, and
reuses it for each narration segment. `VIENEU_BACKEND=auto` selects the v3 Turbo ONNX CPU path on
CPU; set `VIENEU_BACKEND=pytorch` only when the runtime has the corresponding GPU stack. The worker
can enroll references through the ONNX/CPU path without importing PyTorch or TorchAudio. The sample
is never copied into a durable job payload. Real-person samples require explicit consent.

The worker image runs as non-root `appuser` with a writable `/home/appuser` runtime home. VieNeu
3.3's ONNX/CPU voice-cloning path can run without PyTorch/TorchAudio, but the narration target
keeps those packages available for the configured PyTorch backend and compatibility with the
existing runtime. VieNeu's model and profile
caches are stored under `/home/appuser/.cache/huggingface`; this avoids the `/nonexistent` home
assigned by default to Debian system users.

The narration UI can also attach a user-owned MP3 reference to a VieNeu narration request. The
worker downloads that READY audio asset into the ephemeral job directory, validates the 3–8 second
rule, runs `pydub.AudioSegment.from_mp3(...).set_channels(1).export(..., format="wav")`, and passes
the temporary WAV through `ref_audio`. This per-request path does not modify the shared persisted
voice profile. The worker image includes FFmpeg for MP3 decoding.

One audio part may cover multiple Chapters. The worker can translate per-part timestamps into one global audio timeline; physical concatenation is not required just to define timeline continuity.

Production uploaded-audio ingestion/alignment and chapter-local render slicing remain partial.

## Durable media

Cloudflare R2 is authoritative for source/generated/reusable pipeline media. Google Drive is
authoritative for final rendered MP4 files. Worker-local files are scratch/cache/FFmpeg workspace
only; a retry should reuse valid durable media rather than regenerate due solely to lost scratch.

## Role-specific packaging

The worker remains one Python source tree, but its optional dependencies are split by runtime
role. The base project dependencies cover configuration, HTTP, PostgreSQL and Google auth. The
`image` extra adds R2/Pillow support, `narration` adds R2, VieNeu, Torch/TorchAudio, NumPy and
pydub, and `render` adds R2/Pillow plus `ffmpeg-python`. The `dev` extra includes all role
dependencies for the complete test suite.

The Dockerfile exposes these targets:

```text
worker-core       core/analysis and translation dependencies
worker-image      analysis, media-validation and image-generation dependencies
worker-narration  narration dependencies, including VieNeu/Torch
worker-render     render dependencies, including FFmpeg/Pillow
```

Compose selects `worker-image`, `worker-narration` and `worker-render` for the corresponding
services. `WORKER_ROLES` remains a runtime safety check, and `__main__.py` imports only the
selected runner modules so a role does not require another role's optional packages merely to
start or pass its healthcheck.

## Worker authority boundary

The worker may validate/reconcile/retry/fallback only within persisted backend authorization. It must not decide product entitlement, create arbitrary paid work or silently upgrade an IMAGE_MOTION plan to I2V.

## Quality gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
```
