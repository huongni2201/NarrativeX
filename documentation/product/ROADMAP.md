# NarrativeX — V1.11 Roadmap

**Canonical baseline:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Planning rule:** dependency order, not fixed-date commitment.

## Current checkpoint — IMPLEMENTED foundations

```text
Create/Edit Chapter
  -> durable Analyze
  -> Character/Location + Scene/VisualBeat continuity
  -> TTS narration + alignment OR USER_PROVIDED_AUDIO logical timeline
  -> backend-authoritative MediaPlan foundation
```

Also implemented: ProviderOperation/Chapter/Project MyBatis persistence foundations, R2-only durable media topology, worker claim/lease/heartbeat, and user-provided-audio TTS-bypass planning.

## Track A — Finish persistence simplification

### A1 — StoryVersion MyBatis — NEXT
- explicit row/resultMap/SQL;
- append/activation/version invariants;
- PostgreSQL contract tests;
- remove active JPA adapter after cutover.

### A2 — Generation execution persistence — TARGET
- GenerationJob / StageAttempt claim, lease, heartbeat and CAS paths;
- OperationPlan / MediaPlan where legacy adapters remain.

### A3 — Outbox + quota/billing — TARGET
- replace remaining direct JDBC boundaries with semantic MyBatis mappers;
- preserve atomic enqueue/reservation behavior.

### A4 — Storyboard/continuity + low-risk CRUD — TARGET
- Scene/VisualBeat/revisions;
- Character/Location continuity;
- remaining read/query boundaries;
- remove unused JPA infrastructure only after evidence is complete.

## Track B — First durable MP4

### B1 — Narration strategy/timeline — IMPLEMENTED foundation
- `TTS` and `USER_PROVIDED_AUDIO`;
- ordered audio parts;
- one logical global clock;
- one file may cover multiple Chapters;
- uploaded-audio plan does not contain `TTS_GENERATE`.

### B2 — Production user-audio ingestion/alignment — PARTIAL → TARGET
- authorized private R2 upload/finalize;
- MIME/decode/duration/checksum validation;
- real alignment provider/runtime;
- coverage/confidence thresholds and review path.

### B3 — VisualScenePlanner — TARGET
- narration timing is duration authority;
- pin source/analysis/narration identities together;
- adaptive source/audio spans.

### B4 — Image generation execution — TARGET
- one real provider adapter;
- durable ProviderOperation;
- first vertical slice may use `GENERATE_NEW` only;
- validate → R2 → immutable MediaAsset.

### B5 — IMAGE_MOTION renderer — TARGET
- pan/zoom/fade/overlay;
- render against narration spans;
- bounded/incremental FFmpeg workspaces.

### B6 — FinalArtifact — TARGET
- merge/validate MP4;
- checksum/MIME/dimensions/duration manifest;
- private R2 persistence;
- preview/download through backend-authorized access.

## Fast-follow after first durable MP4

- Character review/version/reference locking completion.
- Approved storyboard revision/reset workflow.
- Reuse → reframe → edit → new AssetResolver.
- HYBRID_LOCAL_I2V/Wan runtime hardening and GPU usage reconciliation.
- Full actual-cost ledger/release/refund.
- Output moderation, SSRF-safe media ingestion, retention/deletion, observability and backup/restore evidence.

## First-video acceptance scenario

Given 10 selected Chapters and one or several valid user-provided audio files, NarrativeX can align one logical narration timeline, skip TTS, generate durable images, render `IMAGE_MOTION`, validate the final MP4 and persist it to R2 without relying on worker-local paths.
