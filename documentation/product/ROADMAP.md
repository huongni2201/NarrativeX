# NarrativeX — V1.11 Roadmap

**Canonical baseline:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Planning rule:** dependency order, not fixed-date commitment.

## Current checkpoint — IMPLEMENTED foundations

```text
Create/Edit Chapter
  -> durable Analyze
  -> Character/Location + Scene/VisualBeat continuity
  -> TTS/VieNeu narration + alignment
  -> backend-authoritative MediaPlan
  -> Vertex image generation -> R2 image assets
  -> IMAGE_MOTION chapter render
  -> Google Drive final MP4
```

Also implemented as foundations: worker claim/lease/heartbeat, user-provided-audio TTS-bypass planning, project-scoped Character list/detail reads, normalized CharacterVersion references, authoritative Chapter media heads, MyBatis-only production persistence, local render quota settlement, local-device pairing, and provider-aware FinalArtifact metadata.

## Track A — Preserve persistence architecture — IMPLEMENTED

Production persistence is MyBatis + explicit SQL. Further work here is maintenance, query optimization and regression prevention rather than framework migration.

## Track B — Finish the complete creator loop

### B1 — Generated narration path — IMPLEMENTED foundation
- Google TTS/local VieNeu execution;
- R2-backed narration media;
- alignment/timing foundation;
- render worker can load generated narration matching the pinned Chapter snapshot.

### B2 — User-provided narration E2E — PARTIAL → TARGET
- authorized private R2 upload/finalize;
- MIME/decode/duration/checksum validation;
- ordered multi-file logical timeline;
- alignment coverage/confidence/review hardening;
- **remaining render gap:** slice/stitch aligned narration parts for chapter-local render input.

### B3 — VisualScenePlanner — TARGET
- narration timing is duration authority;
- pin source/analysis/narration identities together;
- adaptive source/audio spans and reviewable scene plan.

### B4 — Image generation execution — IMPLEMENTED foundation
- Vertex image provider/batch path exists;
- generated images are validated and persisted to R2;
- renderer consumes READY image assets;
- remaining work is richer review/reuse/reframe/edit lineage and affected-scope regeneration.

### B5 — IMAGE_MOTION renderer — IMPLEMENTED foundation
- dedicated render worker exists;
- pinned MediaPlan/image assets + narration snapshot;
- deterministic FFmpeg image motion;
- ffprobe validation and SHA-256;
- local render quota settlement.

### B6 — Google Drive FinalArtifact — IMPLEMENTED foundation
- final MP4 is uploaded directly from local render workspace to Google Drive;
- resumable chunk upload;
- render-fingerprint lookup for idempotency;
- remote size verification;
- `storageProvider`, Drive file ID and optional web-view link are persisted;
- final MP4 is not duplicated into R2 by default.

### B7 — Final video delivery — IMPLEMENTED foundation
- owner-authorized preview/download/streaming from private Drive through the backend OAuth proxy with HTTP Range support;
- provider-neutral read/stream contract for future YouTube/Facebook/TikTok publishing;
- production storage health/config checks.

### B8 — Drive retry durability — TARGET hardening
The current Drive upload resumes within a worker attempt and detects an already-uploaded render by fingerprint. The rendered MP4 itself lives in an ephemeral job workspace, so a failed attempt may rerender after the job is reclaimed. Add a durable upload-stage/checkpoint or bounded retained render artifact if upload-only retry across attempts is required.

## Fast-follow after creator-loop reliability

- Character review/version/reference locking completion.
- Approved storyboard revision/reset workflow.
- Reuse → reframe → edit → new AssetResolver.
- HYBRID_LOCAL_I2V/Wan runtime hardening and GPU usage reconciliation.
- Full actual-cost ledger/release/refund.
- Output moderation, SSRF-safe ingestion, retention/deletion, observability and backup/restore evidence.

## Storage checkpoint

```text
Images / narration / uploaded audio / reusable media -> R2
Final rendered MP4                              -> Google Drive
Metadata / lineage / job state                  -> PostgreSQL
```

## Current acceptance scenarios

**Generated narration path:** a pinned Chapter with READY R2 images and matching generated narration can render `IMAGE_MOTION`, validate the MP4 and persist the final video to Google Drive.

**User-provided narration path:** planning/timeline/TTS bypass foundations exist, but do not claim complete multi-Chapter audio → render until aligned parts are sliced/stitched into render input.
