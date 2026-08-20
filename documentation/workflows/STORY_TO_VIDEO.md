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
  -> bounded FFmpeg render
  -> validate FinalArtifact
  -> R2
  -> preview/download
```

The renderer uses audio spans as duration authority. A valid R2 asset is reused across retries instead of regenerated because a worker-local file disappeared.

## Fast-follow

After the first durable MP4:

- reuse/reframe/edit AssetResolver;
- Character/reference lock workflow;
- approved storyboard revisions;
- HYBRID_LOCAL_I2V/Wan hardening;
- full cost/usage ledger reconciliation;
- moderation/SSRF/retention/observability/DR evidence.
