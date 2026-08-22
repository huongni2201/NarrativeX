# Narration and User-Provided Audio Workflow — V1.11

Narration is a first-class timeline consumed by visual planning and rendering. It is not synonymous with TTS.

## Strategy

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

## Generated narration — implemented foundation

Generated narration is persisted as durable audio in Cloudflare R2. Provider execution semantics differ by provider.

### External Google TTS

```text
persisted Chapter source snapshot
  -> deterministic NarrationRequest
  -> external provider operation / reconciliation
  -> validated audio segments/final audio
  -> R2
  -> NarrationAsset metadata
  -> alignment
```

External-provider durability retains provider-operation fencing because an ambiguous network outcome can otherwise duplicate billable work.

### Local VieNeu

VieNeu is local/retryable execution rather than an externally billable provider boundary:

```text
persisted Chapter source
  -> sentence-aware segments
  -> VieNeu local batch inference
  -> PCM only in ephemeral worker workspace
  -> concatenate/encode final MP3
  -> validate + SHA-256
  -> immutable R2 final MP3
  -> NarrationAsset metadata
```

VieNeu does **not** need one durable R2 PCM object/provider operation per local synthesis segment. Failed local inference can be safely regenerated. The final MP3 remains durable in R2.

Production defaults can use CPU/ONNX. GPU/PyTorch requires a GPU-capable runtime/image; changing only an environment variable is not sufficient if the container lacks CUDA/PyTorch support.

`NARRATION_MP3_BITRATE` defaults to `96k`. Audio therefore remains substantially smaller than typical long-form final MP4 output and stays in R2 as reusable pipeline media.

## VieNeu voice reference

Preset voices do not need a reference file. A configured custom/global reference is mounted or supplied as an owned READY audio asset; credentials/reference media are never embedded in a job payload or committed to source control.

When MP3 reference conversion is required, the worker performs the conversion outside the asyncio event loop and uses the ephemeral job workspace. Real-person voice cloning requires explicit consent, tenant isolation, retention and deletion controls before public production use.

## User-provided audio — implemented planning/timeline foundation

```text
selected Chapter revision/source manifest
  + ordered audio parts (1..N)
  -> narration/document fingerprints
  -> one logical global audio clock
  -> alignment spans
  -> alignment status/coverage/confidence
```

One audio part may cover multiple Chapters. Multiple files may cover one Chapter range. File boundaries do not determine Chapter boundaries.

For an accepted covered scope, operation planning omits `TTS_GENERATE`; TTS workload/reservation is zero for that scope.

## User-provided audio ingestion — partial/hardening

The intended durable boundary is:

```text
backend authorizes private R2 upload
  -> client uploads audio
  -> finalize
  -> validate MIME/decode/duration/size/checksum
  -> persist immutable media metadata
  -> accept ordered narration part
  -> align to selected source
```

The model and storage foundations exist, but the complete production-facing upload/finalize/alignment experience still requires hardening. Unsupported/corrupt audio must fail before downstream paid work.

## Current render integration

The current `CHAPTER_RENDER` worker loads a generated narration asset that matches:

```text
projectId
chapterId
chapterRowVersion
sourceHash
```

It does **not** yet resolve aligned `narration_parts` and slice/stitch the relevant global audio spans for a Chapter render.

Therefore the following is still required for full `USER_PROVIDED_AUDIO` rendering:

```text
alignment spans
  -> identify relevant ordered parts
  -> calculate part-local ranges
  -> slice audio ranges
  -> concatenate/stitch across part boundaries when needed
  -> validate one chapter-local render audio file
  -> CHAPTER_RENDER
```

Do not claim the complete multi-Chapter uploaded-audio → render flow until this path exists.

## Alignment acceptance

Alignment maps selected source text to global audio time. At minimum preserve source identity, source span, global audio start/end, confidence and coverage/status.

Low confidence, missing source coverage, timeline gaps or incompatible source identity must stop for review/fix. NarrativeX must not silently replace accepted user-provided narration with generated TTS.

## Chapter Workspace visibility

Submitting a generated narration request returns a durable generation job. The Chapter Workspace keeps the Audio tab available while work is queued/running and prevents duplicate submission. Once a `NarrationAsset` exists, the backend can return short-lived private R2 access for playback; raw storage credentials are never exposed to the browser.

## Cost behavior

For a `USER_PROVIDED_AUDIO` covered scope:

- TTS character workload = 0;
- no TTS provider reservation/operation for that narration scope;
- R2 storage, validation/alignment, image generation, motion and render workload may still be accounted separately.

Local VieNeu synthesis has no external TTS provider charge, while application quota/concurrency policy may still account for local compute.

## Storage contract

```text
Generated narration       -> R2
Accepted uploaded audio   -> R2
Generated images          -> R2
Final rendered MP4        -> Google Drive
```

Audio remains R2-backed; only final rendered MP4 storage moved to Google Drive under ADR-0016.
