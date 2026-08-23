# NarrativeX — V1.11 Implementation Timeline

This is dependency-ordered planning, not a calendar promise. Current status is derived from the V1.11 source of truth plus repository evidence.

## Implemented foundations

- Spring Boot modular monolith + Next.js frontend + Python worker roles.
- PostgreSQL authoritative state; Redis sessions/transient hints.
- Split durable storage: R2 for pipeline media, Google Drive for final rendered MP4.
- Project/Chapter/Analyze foundations plus dashboard/favorite reads.
- ProviderOperation durability/reconciliation and immutable completed-result fingerprint.
- Worker claim/lease/heartbeat and bounded concurrency.
- Character + Location analysis continuity and Scene relations.
- Project-scoped Character list/detail read models.
- Backend-authoritative MediaPlan foundation.
- Google TTS/local VieNeu narration + alignment + R2 final narration media.
- `USER_PROVIDED_AUDIO` planning: ordered parts, logical global timeline, multi-Chapter coverage and TTS bypass.
- Real Vertex image generation with validated R2 image materialization.
- Dedicated deterministic `IMAGE_MOTION` chapter render using FFmpeg + ffprobe.
- Google Drive resumable final-MP4 upload and provider-aware FinalArtifact metadata.
- MyBatis + explicit SQL production persistence across backend features.

## Completed workstream — MyBatis convergence

Production persistence uses MyBatis + explicit SQL. Further work here is maintenance, regression prevention and query optimization rather than framework migration.

## Completed foundation — generated-narration media loop

```text
Chapter / MediaPlan
  -> generated narration in R2
  -> READY images in R2
  -> CHAPTER_RENDER
  -> FFmpeg IMAGE_MOTION
  -> validation/checksum
  -> Google Drive final MP4
  -> FinalArtifact metadata
```

This is a working foundation, not yet the complete product creator loop.

## Immediate workstream — complete creator loop

1. Harden user-audio upload/finalize and alignment execution.
2. Slice/stitch aligned multi-part uploaded audio into chapter-local render input.
3. Complete narration-driven `VisualScenePlanner` and review flow.
4. Harden image approval/reuse/reframe/edit lineage and affected-scope regeneration.
5. Expose owner-authorized preview/download/streaming for Drive-backed FinalArtifacts through the backend OAuth proxy.
6. Add cross-attempt upload-only retry without rerender if required.
7. Complete actual-cost/ledger reconciliation and production safety/observability evidence.

## Fast-follow

- Character/reference locking and storyboard versioning completion;
- reuse/reframe/edit AssetResolver optimization;
- HYBRID_LOCAL_I2V runtime hardening;
- social publishing through a provider-neutral final-video read/stream boundary;
- moderation/SSRF/retention/observability/DR production evidence.

The low-cost IMAGE_MOTION path now exists as a production foundation; advanced I2V remains intentionally later.
