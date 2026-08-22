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

After current analysis/review state is available:

```text
TTS
  -> exact source-preserving narration
  -> R2
  -> alignment

USER_PROVIDED_AUDIO
  -> ordered 1..N audio parts
  -> one logical global audio clock
  -> alignment
  -> no TTS_GENERATE stage
```

One user audio file may cover 10+ Chapters; several files may cover the same range. Alignment, not file boundaries, assigns source spans to audio time.

## Media planning

```text
source + analysis/storyboard/continuity
        + narration timeline
        -> VisualScenePlanner
        -> backend-authorized immutable MediaPlan
        -> GenerationJob pinned to plan revision
```

The worker executes the resolved plan; it does not independently choose I2V or paid work.

## First complete V1.11 path

```text
aligned narration timeline
  -> VisualScenePlan[]
  -> image generation (MVP may use GENERATE_NEW only)
  -> validate + R2 immutable MediaAsset
  -> IMAGE_MOTION deterministic pan/zoom/fade/overlay
  -> bounded FFmpeg render to local scratch
  -> validate final.mp4
  -> Google Drive resumable upload through FinalVideoStorage
  -> verify remote file
  -> persist FinalArtifact storage metadata
  -> READY
  -> preview/download
```

The renderer uses audio spans as duration authority. Valid R2 assets are reused across retries instead of regenerated because a worker-local file disappeared.

Final-video upload is a separate retry boundary from render. If Drive upload fails after a successful render, the validated local MP4 is retained for bounded upload retries. NarrativeX must not rerender solely because the remote upload failed.

Final rendered MP4 is not duplicated into R2 by default. R2 remains the durable source/generated/reusable pipeline-media store; Google Drive is the durable final-video target defined by ADR-0016.

## Final video state flow

```text
QUEUED
  -> PREPARING
  -> RENDERING
  -> VALIDATING
  -> UPLOADING
  -> VERIFYING
  -> READY
```

Failure semantics:

```text
RENDERING failure -> RENDER_FAILED
UPLOADING failure -> UPLOAD_FAILED -> retry UPLOADING
VERIFYING failure -> VERIFY_FAILED -> reconcile/retry verification or upload as appropriate
```

Local `final.mp4` may be removed only after remote verification and authoritative PostgreSQL metadata commit succeed.

## Fast-follow

After the first durable MP4:

- reuse/reframe/edit AssetResolver;
- Character/reference lock workflow;
- approved storyboard revisions;
- HYBRID_LOCAL_I2V/Wan hardening;
- full cost/usage ledger reconciliation;
- moderation/SSRF/retention/observability/DR evidence;
- social publishing adapters consuming `FinalVideoStorage` without coupling render policy to Google Drive.

## MVP render contract

For the MVP, the flow is intentionally split:

`approved storyboard + READY narration/alignment -> CHAPTER_GENERATE -> keyframe review -> CHAPTER_RENDER -> artifact`

`CHAPTER_RENDER` pins the exact approved image asset IDs/checksums and ordered narration spans in an immutable manifest. `IMAGE_MOTION` uses deterministic FFmpeg pan/zoom/hold/fade transforms; narration timing is the duration authority. The worker must not add I2V work, switch provider/model, or replace manifest inputs with newer chapter data.

Final artifacts are private. Their durable identity is provider-neutral (`storageProvider`, `storageObjectId`) and delivery remains owner-authorized. Google Drive share/public URLs are not the correctness boundary.
