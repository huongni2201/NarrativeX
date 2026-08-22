# NarrativeX — Project Source of Truth V1.11

**Status:** Canonical engineering direction and code-aligned baseline  
**Effective date:** 22/08/2026  
**Repository:** `huongni2201/NarrativeX`  
**Docs-sync implementation checkpoint:** `feat/final-video-google-drive` at `b26e4792d933e787526ea1bb6cb85dfcc5d4c87e`  
**Supersedes:** V1.10 as the planning baseline for new work

---

## 1. Authority and status semantics

V1.11 is the maintained product/domain/architecture baseline. Accepted ADRs refine cross-cutting decisions. Current code and Flyway migrations decide factual AS-IS implementation claims when a derived document drifts.

Status vocabulary:

- **IMPLEMENTED** — a working code path exists at the documented checkpoint.
- **IMPLEMENTED foundation** — the core runtime boundary exists, but the complete product workflow is not yet proven.
- **PARTIAL** — some required runtime/product pieces are still missing.
- **TARGET** — approved next implementation direction.
- **DEFERRED** — intentionally postponed until the creator loop is reliable.

Roadmap intent must never be presented as implemented behavior.

---

## 2. Product definition

NarrativeX is an AI-assisted long-form story-video studio. It transforms persisted Chapter source into structured analysis, continuity-aware visual plans, durable media assets and final long-form video.

The product is:

- **chapter-first** — Chapter is the primary authoring/source unit;
- **review-first** — generated state is inspectable/versioned instead of silently replacing approved history;
- **audio-timeline-first** — narration timing is authoritative for visual duration;
- **image-first** — deterministic image motion is the default low-cost render path;
- **durable-by-design** — PostgreSQL owns authoritative state, R2 owns pipeline media, and Google Drive owns final rendered MP4 bytes;
- **backend-authorized** — workers execute persisted plans and may not invent paid work.

Creating a Project only persists metadata. Saving a Chapter only persists source. Analyze, narration/audio processing, image generation and rendering are explicit operations.

---

## 3. Non-negotiable invariants

### 3.1 Source preservation

Expensive work pins the authoritative source identity:

```text
chapterId
chapterRowVersion
sourceHash
```

A later Chapter edit creates a new source identity. Historical approved/generated outputs are not rewritten in place.

### 3.2 Narration is not synonymous with TTS

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

If accepted user-provided audio covers a scope, NarrativeX must not generate or reserve TTS for that same scope.

### 3.3 Audio file boundaries are not Chapter boundaries

A user may provide one continuous audio file for many Chapters or several ordered files for one selected range. The durable model uses an ordered narration set plus one logical global audio clock. Alignment maps source spans to audio spans.

### 3.4 Backend owns execution policy

The backend creates/version-controls the authorized `MediaPlan`, including `ProductionMode`, resolved `MotionStrategy`, workload and cost/reservation context. A `GenerationJob` pins the exact plan revision. The worker executes persisted policy and must not silently escalate deterministic motion to I2V.

### 3.5 Durable binary storage is split by lifecycle

Cloudflare R2 is authoritative for source/generated/reusable pipeline media, including generated images, narration/TTS audio, uploaded media accepted into the pipeline, thumbnails and reusable media assets.

Google Drive is authoritative for final rendered MP4 exports. Final MP4 files are not duplicated into R2 by default.

PostgreSQL stores storage provider identity, external object identity, checksum, size, lineage and render metadata. Worker-local files are scratch/cache/FFmpeg workspace only.

ADR-0012 remains authoritative for R2-backed pipeline media. ADR-0016 supersedes ADR-0012 only for final rendered MP4 storage.

### 3.6 Persistence is MyBatis + explicit SQL

Production backend persistence uses technology-neutral application/domain ports backed by MyBatis row models, mapper interfaces/XML and explicit PostgreSQL SQL. The backend build has no JPA dependency and production source has no direct `JdbcTemplate` persistence.

---

## 4. Current implementation baseline

| Capability | V1.11 state | Notes |
|---|---|---|
| Project/Chapter authoring | IMPLEMENTED foundation | Project and Chapter persistence are MyBatis-backed |
| Project dashboard/favorite | IMPLEMENTED foundation | backend contracts and frontend wiring exist |
| Chapter Analyze | IMPLEMENTED | durable admission/enqueue and worker execution |
| Worker claim/lease/heartbeat | IMPLEMENTED | PostgreSQL-backed |
| ProviderOperation durability | IMPLEMENTED foundation | reconciliation/result immutability foundation exists |
| Generation execution persistence | IMPLEMENTED | GenerationJob, StageAttempt, OperationPlan, MediaPlan, outbox and Job History use explicit SQL/MyBatis |
| Character + Location continuity | IMPLEMENTED foundation | full human review/reference locking remains partial |
| Project Character list/detail | IMPLEMENTED foundation | project-scoped authoritative reads are wired end to end |
| Scene + VisualBeat | IMPLEMENTED foundation | richer revision/review flows remain partial |
| Backend-authoritative MediaPlan | IMPLEMENTED foundation | immutable revision and job pinning exist |
| Full-chapter generated narration | IMPLEMENTED foundation | Google TTS / local VieNeu paths with R2 durability |
| Narration alignment | IMPLEMENTED foundation | source/audio timing model exists |
| `USER_PROVIDED_AUDIO` planning/timeline | IMPLEMENTED foundation | ordered parts, global clock, fingerprints and TTS bypass |
| User-provided audio ingestion/alignment E2E | PARTIAL | complete production-facing flow still needs hardening |
| Vertex image generation | IMPLEMENTED foundation | real Vertex image path with durable R2 image materialization exists |
| Immutable image media lifecycle | IMPLEMENTED foundation | renderer consumes READY R2 image assets; richer approval/reuse lineage remains partial |
| IMAGE_MOTION chapter render | IMPLEMENTED foundation | dedicated durable render worker executes FFmpeg and validates MP4 |
| Google Drive final MP4 storage | IMPLEMENTED foundation | resumable upload, fingerprint lookup, remote size verification and FinalArtifact metadata exist |
| Render with generated narration snapshot | IMPLEMENTED foundation | render worker loads matching generated narration |
| Render with multi-part user-provided narration | PARTIAL | chapter-range slicing/stitching from aligned uploaded parts is not implemented in the render worker |
| Preview/download/publishing from Drive | PARTIAL/TARGET | metadata is exposed; controlled streaming/download/publishing boundary still needs completion |
| MyBatis-only production persistence | IMPLEMENTED | architecture boundary is complete |
| VisualScenePlanner | TARGET | narration-driven adaptive visual planning remains incomplete |
| Reuse/reframe/edit AssetResolver | DEFERRED fast-follow | optimize after creator loop reliability |
| HYBRID_LOCAL_I2V end-to-end | DEFERRED fast-follow | selected-beat private I2V |
| Complete actual-cost reconciliation | PARTIAL | reservation and local render settlement foundations exist |

---

## 5. Canonical topology and authority

```text
Browser / Next.js Studio
        |
        v
Spring Boot Backend
  -> PostgreSQL      authoritative domain/job/plan/usage/storage metadata
  -> Redis           Spring Session + transient/non-authoritative hints
        |
        v
Python AI / Media Worker
  -> Vertex analysis/image execution
  -> narration/alignment execution
  -> R2 source/generated/reusable media
  -> local FFmpeg render workspace
  -> Google Drive final MP4 upload
```

PostgreSQL owns source versions, domain state, plans, jobs, stages, provider operations, reservations/usage metadata and media/final-artifact lineage. Redis must never be the only record of generation correctness.

---

## 6. Durable execution contract

```text
Source Snapshot / Reviewed State
  -> OperationPlan / MediaPlan
  -> GenerationJob
  -> StageAttempt
  -> ProviderOperation when crossing a provider boundary
  -> validated result
  -> durable binary storage + PostgreSQL metadata
  -> terminal durable stage/job state
```

Long network/provider calls must not hold long business database transactions open. Stage lease/heartbeat state is durable. A worker that loses its lease cannot finalize successful output for that lease.

For R2-backed pipeline media, completion means validated bytes are durable in R2 and metadata is committed.

For a final rendered MP4, completion means local FFmpeg validation succeeded, Drive upload/verification succeeded and `final_artifacts` metadata is committed.

---

## 7. ProviderOperation invariants

Provider execution is a money/content boundary:

```text
RESERVED
  -> SUBMITTED
  -> RUNNING
  -> COMPLETED | FAILED

ambiguous timeout/outcome
  -> UNKNOWN
  -> reconcile before any resubmit
```

Retries reuse deterministic request identity. Terminal completed/failed state does not reopen. Completed results are immutable by result fingerprint.

---

## 8. Narration architecture

### 8.1 Generated narration

```text
persisted exact Chapter source
  -> NarrationRequest
  -> Google TTS or local VieNeu
  -> validate/normalize
  -> R2
  -> immutable narration metadata
  -> alignment
```

Generated narration audio remains in R2. At the current default 96 kbps MP3 setting, audio is small relative to final MP4 storage and remains a reusable pipeline asset.

### 8.2 User-provided audio

```text
selected Chapter source manifest
  + ordered audio parts (1..N)
  -> R2 upload/finalize + validation
  -> narration/document fingerprints
  -> one logical global audio clock
  -> alignment spans
```

The planning/timeline foundation exists. The render worker does not yet slice/stitch aligned multi-part user audio into chapter-local render input, so this must remain a PARTIAL claim.

---

## 9. Visual planning and timing authority

Narration timing is the duration authority. `VisualScenePlanner` remains the intended adaptive planner:

```text
source + analysis/storyboard + continuity + narration alignment
  -> VisualScenePlanner
  -> VisualScenePlan[]
```

Current rendering can consume persisted media beat plans and READY image assets, but this does not mean the complete narration-driven planner/review workflow is finished.

---

## 10. Production modes

```text
ProductionMode
  IMAGE_MOTION
  HYBRID_LOCAL_I2V

MotionStrategy
  BASIC_IMAGE_MOTION
  IMAGE_TO_VIDEO
```

`IMAGE_MOTION` authorizes deterministic image motion only and never I2V. A real FFmpeg chapter render path now exists. `HYBRID_LOCAL_I2V` remains deferred fast-follow work.

---

## 11. Image generation and media durability

Production image execution uses the authorized image generation plan and current Vertex adapter path. Validated images are stored as immutable R2 media assets before render.

```text
planned image operation
  -> provider execution
  -> validate image payload
  -> immutable R2 object
  -> MediaAsset metadata
  -> READY media generation item
```

The long-term asset resolver remains reuse-first:

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

The current production foundation may generate new images; richer reuse/approval/derivation remains incomplete.

---

## 12. Current final render path

The implemented chapter render foundation is:

```text
pinned CHAPTER_RENDER job
  -> load exact MediaPlan revision
  -> load READY image assets from R2
  -> load matching generated narration from R2
  -> normalize beat durations against narration duration
  -> FFmpeg IMAGE_MOTION render in local workspace
  -> ffprobe validation
  -> SHA-256
  -> Google Drive resumable upload
  -> lookup/verify Drive file by render fingerprint + expected size
  -> persist render_manifest + final_artifacts
  -> mark render stage/job COMPLETED
```

The current `final_artifacts` storage shape records:

```text
storageProvider = GOOGLE_DRIVE
storageKey = gdrive:<driveFileId>
externalFileId = <driveFileId>
webViewLink = <optional Drive UI link>
checksumSha256
sizeBytes
durationMs
width
height
fps
```

The Drive file ID, not the web-view URL, is the remote object identity.

Final video bytes are not written to R2.

### Current retry limitation

Drive chunk upload supports resumable upload inside a worker attempt and the adapter searches by `renderFingerprint` before creating a new file, which makes retries idempotent after a successful remote upload.

However, the validated local MP4 is still inside an ephemeral job workspace. If the job is marked `STALLED` after a Drive failure and the worker attempt exits, the next claim may rerender before retrying Drive. Preserving a validated local MP4 across job attempts is a TARGET hardening item; docs must not claim that upload retry is already a fully separate durable stage.

---

## 13. Cost, reservation and actual usage

NarrativeX distinguishes:

```text
expectedCost
reservationCeiling
actualCost
```

Provider work reconciles external cost where applicable. Local `CHAPTER_RENDER` consumes application credits through the local-render quota settlement path rather than fabricating provider billing.

For `USER_PROVIDED_AUDIO`, TTS workload is zero for the covered scope, while storage/alignment/image/render workload may still be metered.

---

## 14. Review, history and continuity

Character is reusable identity; ProjectCharacter is project participation/context. Appearance/outfit changes do not create a new Character identity.

Re-analysis must not destructively replace approved Storyboard history. Regeneration creates new attempts/assets and preserves previous durable outputs for audit/review. When inputs change, prefer affected-scope invalidation rather than rebuilding unrelated work.

---

## 15. Security, access and secrets

- R2 pipeline objects are private by default.
- Google Drive final files are private by default; `anyoneWithLink` is not part of the storage contract.
- OAuth client secret and Drive refresh token are server/worker secrets and must never reach the browser or source control.
- Drive production configuration uses `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID` and timeout settings on the render worker only.
- Uploaded/provider media is untrusted until validation succeeds.
- Browser/client access must remain owner-authorized; a Drive UI link is convenience metadata, not authorization.

---

## 16. Current production storage contract

```text
Generated images          -> R2
Generated narration       -> R2
Accepted uploaded audio   -> R2
Reusable media assets     -> R2
Final rendered MP4        -> Google Drive
PostgreSQL                -> metadata, lineage, provider/external IDs, checksums and state
Worker local filesystem   -> ephemeral scratch only
```

This split is the current storage direction and replaces any older statement that R2 is the sole durable media store.

---

## 17. Remaining release-critical work

1. Harden user-provided audio upload/finalize/alignment and connect aligned multi-part audio to render slicing/stitching.
2. Complete narration-driven `VisualScenePlanner` and review/approval workflow.
3. Harden image review/reuse/lineage and affected-scope regeneration.
4. Add backend-authorized preview/download/streaming for Google Drive final artifacts.
5. Preserve validated local renders across Drive retry attempts or materialize a durable upload-stage boundary if rerender avoidance is required.
6. Complete actual usage/billing reconciliation and release/refund behavior.
7. Add production health/configuration checks for Drive credentials and storage availability.
8. Complete moderation, SSRF, retention/deletion, observability and disaster-recovery evidence.
9. Add social publishing through a provider-neutral final-video read/stream boundary without making Drive files public.

---

## 18. Documentation rules

- This V1.11 file is the single maintained versioned source of truth.
- Do not recreate V1.10/V1.9 as parallel current specs.
- ADR-0012 governs R2 pipeline media; ADR-0016 governs final MP4 storage.
- Current code decides AS-IS claims; target architecture must be explicitly labeled TARGET.
- Derived docs must not claim `R2-only`, `R2 FinalArtifact`, unfinished image generation, or unfinished Google Drive final storage after this checkpoint.
- Derived docs must also not claim that multi-part uploaded narration rendering or cross-attempt Drive upload retry is complete until code proves it.
