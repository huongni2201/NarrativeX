# Current implementation traceability — V1.11

This codebase-level matrix is a compact implementation view. The canonical contract is `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`; the primary capability/evidence matrix is `../TRACEABILITY.md`.

## High-level status

Core authoring/analyze/generation durability is implemented as a foundation, and the repository now also contains real image-generation, deterministic chapter-render and Google Drive final-video storage paths.

| Area | Current status |
|---|---|
| Authentication | IMPLEMENTED foundation |
| Project/Chapter lifecycle | IMPLEMENTED foundation |
| Project dashboard/favorite | IMPLEMENTED foundation |
| Chapter Analyze enqueue/execution | IMPLEMENTED |
| Safety/entitlement/quota/cost admission | IMPLEMENTED MVP foundation |
| ProviderOperation durability | IMPLEMENTED foundation with CAS/reconciliation/result-fingerprint invariants |
| Generation persistence | IMPLEMENTED across covered durable execution boundaries |
| Worker concurrency/lease | IMPLEMENTED bounded concurrency |
| Storyboard persistence | IMPLEMENTED foundation; richer approved reset/version editing remains partial |
| Character continuity | IMPLEMENTED foundation; full reference locking/review remains partial |
| Location continuity | IMPLEMENTED foundation; richer review/reference workflow remains partial |
| Frontend API integration | IMPLEMENTED foundation across core project/chapter/Character reads |
| Generated narration | IMPLEMENTED foundation with R2-backed durable audio |
| User-provided narration | IMPLEMENTED planning/timeline foundation; production E2E remains PARTIAL |
| Vertex image generation | IMPLEMENTED foundation; validated outputs persist to R2 |
| IMAGE_MOTION chapter render | IMPLEMENTED foundation; dedicated FFmpeg/ffprobe render worker |
| Google Drive final MP4 storage | IMPLEMENTED foundation; resumable upload + provider-aware FinalArtifact metadata |
| Uploaded multi-part audio -> render | PARTIAL; slicing/stitching from alignment is missing |
| Drive preview/download/streaming | IMPLEMENTED; owner-authorized backend proxy with OAuth refresh and HTTP Range streaming |
| Cross-attempt upload-only retry | TARGET hardening |
| MyBatis-only production persistence | IMPLEMENTED |
| Authoritative Chapter media head | IMPLEMENTED; workspace hydration and stale-plan checks use PostgreSQL projection |
| Character reference assets | IMPLEMENTED foundation; normalized and included in image-generation snapshots |
| Local device management | IMPLEMENTED foundation; pairing/capability/revocation state is durable |

## Durable media/storage contract

```text
Generated images / narration / accepted uploaded audio -> Cloudflare R2
Final rendered MP4                                  -> Google Drive
Authoritative metadata/state/lineage                -> PostgreSQL
Worker scratch                                      -> local ephemeral filesystem
```

## Current generated-narration render path

```text
CHAPTER_RENDER
 -> pinned MediaPlan revision
 -> READY R2 images
 -> matching generated R2 narration
 -> FFmpeg IMAGE_MOTION
 -> ffprobe/checksum validation
 -> Google Drive resumable upload
 -> remote file verification
 -> render_manifest + FinalArtifact metadata
 -> COMPLETED
```

The final MP4 is not retained in R2 by default.

## Remaining production gaps

1. Harden user-audio upload/finalize/alignment and connect aligned multi-part audio to render slicing/stitching.
2. Complete narration-driven VisualScenePlanner/review workflow.
3. Harden image approval/reuse/reframe/edit lineage.
4. Add cross-attempt upload-only retry without rerender if required.
5. Complete billing ledger/actual usage reconciliation.
6. Complete Character reference locking/storyboard review flows.
7. Complete moderation/SSRF/retention/observability/restore evidence.
