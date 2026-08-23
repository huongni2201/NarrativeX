# NarrativeX V1.11 Baseline Implementation Traceability

This matrix maps the V1.11 contract to repository evidence at the validated baseline implementation checkpoint `fix/render-snapshot-retry-integrity` / `a167a88709e342b882cef0ceea6f0d6bd4122e4f`. Code and migrations after that checkpoint remain authoritative for newer AS-IS behavior; this document must not imply the historical checkpoint is the current Git HEAD.

| Capability / invariant | Evidence | Status |
|---|---|---|
| Project/Chapter authoring and durable Analyze | backend commands/use cases/MyBatis + worker claim lifecycle | IMPLEMENTED |
| Generation durable persistence | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox/job history explicit SQL/MyBatis | IMPLEMENTED |
| ProviderOperation lifecycle | durable provider/reconciliation/result fingerprint path | IMPLEMENTED foundation |
| Character + Location continuity and Scene relations | worker materialization + project Character reads | IMPLEMENTED foundation |
| Backend-authoritative MediaPlan | immutable plan revision + job pointer + motion resolver | IMPLEMENTED foundation |
| Generated TTS/VieNeu narration | narration worker + R2 storage | IMPLEMENTED foundation |
| R2-backed generated narration durability | S3-compatible R2 storage adapter | IMPLEMENTED |
| `USER_PROVIDED_AUDIO` planning/timeline/TTS bypass | narration strategy, ordered parts, timeline/fingerprint model | IMPLEMENTED foundation |
| Production uploaded-audio E2E | ingestion/alignment foundations exist; complete user-facing path needs hardening | PARTIAL |
| Vertex image generation | real Vertex image provider/batch execution + R2 materialization | IMPLEMENTED foundation |
| READY image assets consumed by renderer | media plan/image asset repository queries | IMPLEMENTED foundation |
| IMAGE_MOTION chapter render | dedicated render role, FFmpeg image motion, ffprobe validation | IMPLEMENTED foundation |
| Local render quota settlement | consolidated Flyway schema + explicit quota persistence | IMPLEMENTED |
| Final MP4 in Google Drive | `GoogleDriveFinalVideoStorage`, resumable upload, remote lookup/size verification | IMPLEMENTED foundation |
| FinalArtifact Drive metadata | consolidated Flyway schema + MyBatis fields `storageProvider`, external file id, web view link | IMPLEMENTED foundation |
| Final MP4 excluded from R2 | render worker promotes validated local MP4 directly to Drive | IMPLEMENTED |
| Render with generated narration snapshot | render repository loads matching generated narration by chapter row-version/source-hash | IMPLEMENTED foundation |
| Render with aligned multi-part uploaded narration | render worker has no slicing/stitching path for narration parts | PARTIAL |
| Cross-attempt upload retry without rerender | resumable upload works within an attempt; render workspace is ephemeral after stalled attempt | TARGET hardening |
| Owner-authorized preview/download/stream of Drive final | backend proxy with OAuth refresh, ownership check and HTTP Range streaming | IMPLEMENTED |
| MyBatis-only production persistence | production adapters use MyBatis + explicit SQL | IMPLEMENTED |
| VisualScenePlanner | full narration-driven planner/review vertical slice remains incomplete | TARGET |
| Reuse/reframe/edit AssetResolver | architecture defined, intentionally postponed | DEFERRED |
| HYBRID_LOCAL_I2V | adapter/planning foundation only | DEFERRED fast-follow |
| Complete actual usage/billing reconciliation | reservation/local render foundations exist | PARTIAL |

## Current non-claims

NarrativeX now has real production foundations for image generation, deterministic chapter rendering and Google Drive final-video storage. Documentation must not describe these as unimplemented `TARGET` capabilities.

NarrativeX still does **not** claim the complete multi-Chapter user-provided-audio → final-video loop: the current render worker requires generated narration matching the pinned Chapter snapshot and does not yet slice/stitch aligned narration parts.

The Drive adapter performs resumable upload and idempotent fingerprint lookup, but the validated local MP4 is stored in an ephemeral worker job directory. Cross-attempt upload-only retry therefore remains a hardening target.

## Storage invariants

1. PostgreSQL is durable application/execution authority.
2. R2 stores source/generated/reusable pipeline media, including images and narration audio.
3. Google Drive stores final rendered MP4 exports.
4. Final MP4 is not duplicated to R2 by default.
5. Worker-local paths are never authoritative durable assets.
6. Drive file ID/provider metadata, not a public/share URL, identifies a final remote object.
7. Drive files are private by default.

## Execution invariants

1. `USER_PROVIDED_AUDIO` bypasses TTS for its covered scope.
2. Audio file boundaries are not Chapter boundaries.
3. Backend MediaPlan/motion policy is authoritative.
4. `IMAGE_MOTION` never authorizes I2V.
5. Provider `UNKNOWN` reconciles before resubmission.
6. Completed provider results are immutable by fingerprint.
7. A render is not completed before FFmpeg validation, Drive durability/verification and PostgreSQL FinalArtifact metadata commit.
