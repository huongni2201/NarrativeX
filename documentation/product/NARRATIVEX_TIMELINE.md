# NarrativeX — V1.11 Implementation Timeline

This is dependency-ordered planning, not a calendar promise. Current status is derived from the V1.11 source of truth plus repository evidence.

## Implemented foundation

- Spring Boot modular monolith + Next.js frontend + Python worker.
- PostgreSQL authoritative state; Redis sessions/transient hints.
- R2-only durable media storage.
- Project/Chapter/Analyze foundations.
- ProviderOperation durability/reconciliation and immutable completed-result fingerprint.
- Worker claim/lease/heartbeat and bounded concurrency.
- Character + Location analysis continuity and Scene relations.
- Backend-authoritative MediaPlan foundation.
- Full-chapter TTS narration + alignment + R2 media.
- `NarrationStrategy.USER_PROVIDED_AUDIO` foundation: ordered parts, logical global timeline, multi-Chapter coverage and TTS-bypass planning.
- MyBatis persistence for ProviderOperation, Chapter and Project.

## Immediate workstream 1 — MyBatis convergence

1. StoryVersion.
2. GenerationJob / StageAttempt / OperationPlan/MediaPlan legacy boundaries.
3. Outbox and quota/billing JDBC boundaries.
4. Storyboard and continuity repositories.
5. Remaining low-risk CRUD/query boundaries.
6. Remove unused JPA/JDBC infrastructure only after PostgreSQL evidence.

## Immediate workstream 2 — First complete media loop

1. Harden user-audio upload/finalize and alignment execution.
2. Build narration-driven VisualScenePlanner.
3. Add one production image-generation provider path.
4. Persist immutable image MediaAssets to R2.
5. Implement deterministic IMAGE_MOTION FFmpeg rendering.
6. Validate/persist FinalArtifact and expose preview/download.

## Fast-follow

- reuse/reframe/edit AssetResolver;
- Character/reference locking and storyboard versioning completion;
- HYBRID_LOCAL_I2V runtime hardening;
- full actual-cost/ledger reconciliation;
- moderation/SSRF/retention/observability/DR production evidence.

The low-cost image-motion path is intentionally completed before advanced I2V optimization.
