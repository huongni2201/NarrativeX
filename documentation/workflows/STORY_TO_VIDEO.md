# Story-to-Video Workflow — V1.11

NarrativeX is Chapter-first, audio-timeline-first and image-first. Video duration and visual count are adaptive.

## Entry

```text
Create Project -> metadata only
Save Chapter   -> persisted source only
Analyze        -> explicit durable operation
```

## Analysis foundation — implemented

```text
persisted Chapter
  -> lock/reload snapshot
  -> safety/entitlement/quota/cost admission
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> worker claim/lease/heartbeat
  -> ProviderOperation execution/reconciliation
  -> stale Chapter guard
  -> Character + Location + Scene + VisualBeat continuity
```

## Narration selection

```text
GENERATED NARRATION
  -> Google TTS or local VieNeu
  -> validate/normalize
  -> R2
  -> alignment

USER_PROVIDED_AUDIO
  -> ordered 1..N R2-backed audio parts
  -> one logical global audio clock
  -> alignment
  -> no TTS_GENERATE stage
```

One user audio file may cover many Chapters and several files may cover the same selected range. Alignment, not file boundaries, assigns source spans to audio time.

## Media planning and images

The backend owns MediaPlan authorization and the worker executes the pinned plan. Real Vertex image generation now exists as a production foundation:

```text
pinned image-generation work
  -> Vertex image execution
  -> validate
  -> immutable R2 image asset
  -> READY media input
```

`VisualScenePlanner` remains incomplete as the richer narration-driven adaptive planning/review layer. Existing persisted media beat plans can already feed the current renderer.

## Current generated-narration render path — implemented foundation

```text
CHAPTER_RENDER
  -> load exact MediaPlan revision
  -> load READY R2 image assets
  -> load generated narration matching chapterRowVersion + sourceHash
  -> normalize beat durations to narration duration
  -> FFmpeg IMAGE_MOTION in local scratch
  -> ffprobe validation + SHA-256
  -> Google Drive resumable upload
  -> verify Drive file ID + size
  -> persist render_manifest + FinalArtifact Drive metadata
  -> mark stage/job COMPLETED
```

The final rendered MP4 is not duplicated into R2 by default.

## User-provided narration render path — partial

The planning/timeline/TTS-bypass model exists, but the current render repository loads generated narration rather than resolving aligned `narration_parts` for a selected Chapter range.

Before claiming this path complete, the renderer must:

```text
alignment spans
  -> locate relevant ordered uploaded-audio parts
  -> slice chapter/global timeline ranges
  -> concatenate/stitch where necessary
  -> create one validated chapter-local render audio input
  -> IMAGE_MOTION render
```

Until then, do not describe the full multi-Chapter uploaded-audio → final-video loop as implemented.

## Current render job state semantics

The current implementation uses one durable `CHAPTER_RENDER` stage rather than separate durable PREPARING/RENDERING/UPLOADING/VERIFYING stages.

```text
GenerationJob / StageAttempt
  QUEUED or STALLED
    -> RUNNING / CHAPTER_RENDER
    -> render + validate + Drive upload + DB materialization
    -> COMPLETED

retryable infrastructure/Drive failure
    -> STALLED

invalid input / FFmpeg / validation failure
    -> FAILED
```

Sub-stage progress such as RENDERING/UPLOADING/VERIFYING may be added later, but must not be documented as current persisted state until implemented.

## Drive retry behavior

Within one attempt, Drive uses resumable chunk upload and can query the confirmed byte offset after timeout/network ambiguity.

Before creating a file, the adapter searches by `renderFingerprint`; if an earlier upload already completed, a retry can reuse the matching Drive object rather than create a duplicate.

The rendered local MP4 is currently in an ephemeral job workspace. If an upload failure causes the attempt to exit as `STALLED`, a later claim may rerender. Cross-attempt upload-only retry without rerender is a hardening target.

## Storage contract

```text
Images / narration / accepted uploaded audio / reusable media -> R2
Final rendered MP4                                       -> Google Drive
Metadata / lineage / provider identity                   -> PostgreSQL
```

Final artifacts are private. The durable remote identity is the Drive provider/file ID stored by the application; a public/share URL is not the correctness boundary.

## Fast-follow

- complete multi-part user-audio render integration;
- narration-driven VisualScenePlanner/review;
- reuse/reframe/edit AssetResolver;
- Character/reference locking and approved storyboard revisions;
- owner-authorized final-video preview/download/streaming;
- durable upload-only retry across attempts;
- HYBRID_LOCAL_I2V/Wan hardening;
- full cost/usage reconciliation;
- moderation/SSRF/retention/observability/DR;
- social publishing through a provider-neutral final-video stream boundary.
## Deterministic full-stack E2E

The repository's MVP Playwright profile runs the real backend, PostgreSQL, Redis, Python worker,
and FFmpeg while replacing only paid/external provider boundaries. Set `AI_PROVIDER_MODE=fake`,
`IMAGE_PROVIDER_MODE=fake`, `TTS_PROVIDER_MODE=fake`, `MEDIA_STORAGE_MODE=local`, and
`FINAL_VIDEO_STORAGE_MODE=local`. Local final MP4s are written under
`FINAL_VIDEO_LOCAL_DIR`; the backend local artifact adapter serves them with HTTP Range support.
Production keeps Google Drive final-video storage as the default.
