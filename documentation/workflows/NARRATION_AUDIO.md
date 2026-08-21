# Narration and User-Provided Audio Workflow — V1.11

Narration is a first-class timeline consumed by visual planning and rendering. It is not synonymous with TTS.

## Strategy

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

## TTS path — implemented foundation

```text
persisted Chapter source snapshot
  -> deterministic narration request
  -> TTS provider execution
  -> durable narration segments/final audio
  -> validate
  -> Cloudflare R2
  -> immutable narration metadata
  -> alignment spans
```

Generated full-chapter narration uses an ephemeral per-job scratch workspace:

```text
TTS response (one segment)
  -> segment PCM scratch file + immutable R2 segment
  -> chunked file concatenation
  -> FFmpeg input/output scratch files
  -> streaming SHA-256
  -> file-backed immutable R2 upload
  -> PostgreSQL NarrationAsset
  -> workspace cleanup
```

The production path does not aggregate chapter PCM or MP3 into Python `bytes`; local files are
ephemeral and never authoritative. Recovery downloads durable segment objects to scratch files and
rebuilds the final asset without invoking TTS again.

## User-provided audio path — implemented planning/timeline foundation

```text
selected Chapter revision/source manifest
  + ordered audio parts (1..N)
  -> narration/document fingerprints
  -> one logical global audio clock
  -> alignment spans
  -> alignment status/coverage/confidence
  -> VisualScenePlanner
```

One audio part may cover multiple Chapters. Multiple files may cover one Chapter range. Part/file boundaries do not determine Chapter boundaries.

The implemented planner proves:

```text
USER_PROVIDED_AUDIO
  -> CHAPTER_ANALYZE
  -> AUDIO_ALIGN
  -> VISUAL_PLAN
  -> IMAGE_GENERATE
  -> MOTION
  -> RENDER
```

There is no `TTS_GENERATE` stage for that covered scope.

## Production upload/finalize target

The user-facing durable boundary must be:

```text
backend authorizes private R2 key / upload
  -> client uploads audio
  -> finalize
  -> validate media type + decode + duration + size
  -> checksum
  -> persist immutable MediaAsset metadata
  -> accept narration part
  -> align
```

Unsupported/corrupt audio fails before alignment/rendering. Originals remain immutable; optional normalized/derived media is a new asset with source lineage.

## Alignment acceptance

Alignment maps selected source text to global audio time. At minimum track:

```text
chapter/source span
textStart / textEnd
globalAudioStartMs / globalAudioEndMs
confidence
coverage/status
```

Low confidence, missing text coverage, detected gaps or incompatible source identity must stop execution for review/fix. Do not silently generate replacement TTS.

## Cost behavior

For a `USER_PROVIDED_AUDIO` covered scope:

- TTS character workload = 0;
- no TTS reservation/provider operation;
- storage, normalization/alignment, image, motion and render workload may still be billed/accounted.
