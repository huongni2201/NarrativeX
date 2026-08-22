# NarrativeX Current Codebase Map — V1.11

**Canonical baseline:** `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Implementation checkpoint:** `feat/final-video-google-drive` at `b26e4792d933e787526ea1bb6cb85dfcc5d4c87e`

## Runtime layout

```text
app/backend-service/   Java / Spring Boot modular monolith and durable policy/control plane
app/frontend-web/      Next.js / React studio UI
app/ai-worker/         Python async AI/media execution worker
contracts/             versioned cross-runtime contracts
documentation/         V1.11 source, architecture, workflows, ADRs and evidence
Cloudflare R2          durable pipeline-media storage
Google Drive           durable final rendered MP4 storage
```

## Current implementation highlights

- Project/Chapter/Analyze foundations are implemented.
- Production backend persistence is MyBatis + explicit SQL.
- GenerationJob, StageAttempt, OperationPlan, MediaPlan, outbox enqueue/dispatch and Job History are durable.
- Character + Location continuity and project-scoped Character reads exist as foundations.
- Full-chapter generated narration is stored durably in R2; local VieNeu and Google TTS paths exist.
- User-provided narration planning supports ordered parts, one logical global audio clock and TTS bypass.
- Real Vertex image generation is implemented as a production foundation and materializes validated images into R2.
- A dedicated `render` worker claims `CHAPTER_RENDER`, loads pinned READY R2 images + matching generated narration, renders deterministic IMAGE_MOTION with FFmpeg and validates the MP4 with ffprobe.
- Final rendered MP4 is uploaded directly to Google Drive through `GoogleDriveFinalVideoStorage`; it is not persisted to R2 by default.
- `final_artifacts` carries storage provider identity, Drive external file ID, optional web-view link, size/checksum/duration/dimensions/fps metadata.

## Current durable storage map

```text
Generated images          -> R2
Generated narration       -> R2
Accepted uploaded audio   -> R2
Reusable media assets     -> R2
Final rendered MP4        -> Google Drive
Authoritative metadata    -> PostgreSQL
Worker scratch            -> local ephemeral filesystem
```

## Remaining creator-loop gaps

```text
user-audio ingestion/alignment hardening
  -> aligned multi-part audio slicing/stitching for render
  -> complete VisualScenePlanner/review loop
  -> richer image approval/reuse/lineage
  -> owner-authorized Drive preview/download/streaming
  -> cross-attempt Drive upload retry without rerender
```

The current render path is complete only for matching generated narration input; do not describe multi-part uploaded-audio render as complete yet.

## Persistence direction

The migration is complete: production source contains no JPA or direct `JdbcTemplate` persistence. MyBatis row models, mapper interfaces and explicit XML/SQL are the production boundary.

## Worker boundary

The worker owns execution mechanics, provider calls, alignment/media processing, lease/recovery, validation, R2 pipeline media operations and final Google Drive upload. It does not own browser authorization, entitlement policy, MediaPlan authorization or Flyway schema ownership.
