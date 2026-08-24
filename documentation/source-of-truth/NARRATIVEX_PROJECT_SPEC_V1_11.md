# NarrativeX — Project Source of Truth V1.11

**Status:** Canonical engineering direction and code-aligned baseline  
**Effective date:** 23/08/2026  
**Repository:** `huongni2201/NarrativeX`  
**Docs-sync baseline implementation checkpoint:** `main` at `0b8577a5a6b406d34b297a818e663f5db29b06d6`
**Supersedes:** V1.10 as the planning baseline for new work

---

## 1. Authority and status semantics

V1.11 is the maintained product/domain/architecture baseline. Cross-cutting decisions are recorded in consolidated Architecture Decision Records ([ADR-0001](../decisions/ADR-0001-system-topology-execution-and-persistence.md) through [ADR-0004](../decisions/ADR-0004-authentication-runtime-security-and-test-credentials.md)). Current code and Flyway migrations decide factual AS-IS implementation claims when a derived document drifts.

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

[ADR-0003](../decisions/ADR-0003-media-storage-generation-pipelines-and-external-integrations.md) governs media storage, generation pipelines, and external provider integrations.

### 3.6 Persistence is MyBatis + explicit SQL

Production backend persistence uses technology-neutral application/domain ports backed by MyBatis row models, mapper interfaces/XML and explicit PostgreSQL SQL. The backend build has no JPA dependency and production source has no direct `JdbcTemplate` persistence.

### 3.7 Render input snapshot isolation & retry integrity

Render jobs snapshot immutable input headers and beat configurations into `render_input_snapshots` at admission time. Render workers claim and execute exclusively against this snapshotted state, isolating running and retried renders from concurrent edits to MediaPlans or assets.

External side effects (Google Drive upload and FinalArtifact persistence) are serialized across workers using session-scoped PostgreSQL advisory locks on the render fingerprint (`render_fingerprint_lock`), enforcing idempotent checksum reuse.

Provider failure transitions are strictly fenced, preserving `UNKNOWN` state across paid boundaries without blind retries.

---

## 4. Current implementation baseline

| Capability | V1.11 state | Notes |
|---|---|---|
| Project/Chapter authoring | IMPLEMENTED foundation | Project and Chapter persistence are MyBatis-backed |
| Project dashboard/favorite | IMPLEMENTED foundation | backend contracts and frontend wiring exist |
| Chapter Analyze | IMPLEMENTED | durable admission/enqueue and worker execution |
| Worker claim/lease/heartbeat | IMPLEMENTED | PostgreSQL-backed (`sa.stage_name = 'CHAPTER_RENDER'`, skip locked) |
| ProviderOperation durability & failure fencing | IMPLEMENTED foundation | reconciliation/result immutability; preserves `UNKNOWN` across paid boundary |
| Generation execution persistence | IMPLEMENTED | GenerationJob, StageAttempt, OperationPlan, MediaPlan, outbox and Job History use explicit SQL/MyBatis |
| Immutable RenderInputSnapshot admission | IMPLEMENTED | admission-time snapshot of media plan revision, narration assets, and READY image beats into `render_input_snapshots` |
| Character + Location continuity | IMPLEMENTED foundation | full human review/reference locking remains partial |
| Project Character list/detail | IMPLEMENTED foundation | project-scoped authoritative reads are wired end to end |
| Character reference assets | IMPLEMENTED foundation | CharacterVersion references are normalized, owner-authorized and snapshotted into image requests |
| Chapter media head | IMPLEMENTED | durable current-media projection drives workspace hydration and stale-plan rejection |
| Scene + VisualBeat | IMPLEMENTED foundation | richer revision/review flows remain partial |
| Backend-authoritative MediaPlan | IMPLEMENTED foundation | immutable revision and job pinning exist |
| Full-chapter generated narration | IMPLEMENTED foundation | Google TTS / local VieNeu paths with R2 durability |
| Narration alignment | IMPLEMENTED foundation | source/audio timing model with sentence/word spans exists |
| Burned ASS subtitle generation | IMPLEMENTED | deterministic ASS subtitle track from pinned narration alignment or asset cues, burned into MP4 via FFmpeg |
| `USER_PROVIDED_AUDIO` planning/timeline | IMPLEMENTED foundation | ordered parts, global clock, fingerprints and TTS bypass |
| User-provided audio ingestion/alignment E2E | PARTIAL | complete production-facing flow still needs hardening |
| Vertex image generation | IMPLEMENTED foundation | real Vertex image path with durable R2 image materialization exists |
| Immutable image media lifecycle | IMPLEMENTED foundation | renderer consumes READY R2 image assets; richer approval/reuse lineage remains partial |
| IMAGE_MOTION chapter render | IMPLEMENTED | dedicated durable render worker executes FFmpeg with burned ASS subtitles and validates MP4 |
| Google Drive final MP4 storage | IMPLEMENTED foundation | resumable upload, fingerprint lookup, remote size/SHA-256 verification and FinalArtifact metadata exist |
| Cross-worker advisory lock & Drive upload serialization | IMPLEMENTED | PostgreSQL advisory lock on render fingerprint serializes Drive upload and prevents duplicate concurrent attempts |
| Render with generated narration snapshot | IMPLEMENTED | render worker loads matching generated narration |
| Render with multi-part user-provided narration | PARTIAL | chapter-range slicing/stitching from aligned uploaded parts is not implemented in the render worker |
| Preview/download/publishing from Drive | IMPLEMENTED for preview/download | backend-authorized OAuth proxy exposes private Drive media with HTTP Range; publishing remains separate |
| MyBatis-only production persistence | IMPLEMENTED | architecture boundary is complete |
| Local device management | IMPLEMENTED foundation | pairing codes, device capabilities, heartbeat and revocation are persisted in PostgreSQL |
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
Python AI / Media Workers
  -> ai-worker:        Vertex analysis, translation, image generation
  -> narration-worker: TTS / VieNeu narration, alignment execution
  -> render-worker:    IMAGE_MOTION FFmpeg render, burned subtitles, Google Drive upload
  -> Cloudflare R2:    source/generated/reusable pipeline media
  -> Google Drive:     final rendered MP4 exports
```

PostgreSQL owns source versions, domain state, plans, jobs, stages, provider operations, reservations/usage metadata and media/final-artifact lineage. Redis must never be the only record of generation correctness.

---

## 6. Durable execution contract

```text
Source Snapshot / Reviewed State
  -> OperationPlan / MediaPlan
  -> GenerationJob + RenderInputSnapshot (persisted at admission)
  -> StageAttempt
  -> ProviderOperation (when crossing external provider boundary)
  -> validated result
  -> durable binary storage (R2 for pipeline media, Google Drive for final MP4)
  -> PostgreSQL metadata + terminal stage/job state
```

Long network/provider calls must not hold long business database transactions open. Stage lease/heartbeat state is durable. A worker that loses its lease cannot finalize successful output for that lease.

For R2-backed pipeline media, completion means validated bytes are durable in R2 and metadata is committed.

For a final rendered MP4, completion means:
1. Local FFmpeg validation with burned ASS subtitles succeeded;
2. Session-scoped advisory lock was acquired to serialize Drive upload;
3. Drive upload/verification succeeded with matching remote checksum and size;
4. `render_manifest` and `final_artifacts` metadata are committed;
5. Render stage and job are marked `COMPLETED`.

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

Provider failure transitions are strictly fenced: when an ambiguous boundary failure occurs on a paid boundary, the operation remains in `UNKNOWN` state and must not be marked `FAILED` or retried without external reconciliation.

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
  -> alignment (sentence/word spans)
```

Generated narration audio remains in R2. At the current default 96 kbps MP3 setting, audio is small relative to final MP4 storage and remains a reusable pipeline asset.

The alignment spans generated during narration processing serve as the timing source for burned ASS subtitles during video rendering.

### 8.2 User-provided audio

```text
selected Chapter source manifest
  + ordered audio parts (1..N)
  -> R2 upload/finalize + validation
  -> narration/document fingerprints
  -> one logical global audio clock
  -> alignment spans
```

The planning/timeline foundation exists. The render worker does not yet slice/stitch aligned multi-part user audio into chapter-local render input, so this remains a PARTIAL claim.

---

## 9. Visual planning and timing authority

Narration timing is the duration authority. `VisualScenePlanner` remains the intended adaptive planner:

```text
source + analysis/storyboard + continuity + narration alignment
  -> VisualScenePlanner
  -> VisualScenePlan[]
```

Current rendering can consume persisted media beat plans and READY image assets from `render_input_snapshots`, but this does not mean the complete narration-driven planner/review workflow is finished.

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

`IMAGE_MOTION` authorizes deterministic image motion only and never I2V. A real FFmpeg chapter render path with burned ASS subtitles exists. `HYBRID_LOCAL_I2V` remains deferred fast-follow work.

---

## 11. Image generation and media durability

Production image execution uses the authorized image generation plan and current Vertex Gemini 2.5 Flash adapter path. Validated images are stored as immutable R2 media assets before render.

```text
planned image operation
  -> provider execution (Vertex)
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

The current production foundation generates new images; richer reuse/approval/derivation remains incomplete.

---

## 12. Current final render path

The implemented chapter render foundation is:

```text
POST /api/v1/projects/{projectId}/chapters/{chapterId}/render/image-motion
  -> persist immutable RenderInputSnapshot (header + beats)
  -> admit & enqueue CHAPTER_RENDER GenerationJob + StageAttempt
  -> render-worker claims job (sa.stage_name = 'CHAPTER_RENDER')
  -> query exclusively from render_input_snapshots
  -> load READY image assets from R2
  -> load matching generated narration from R2
  -> load pinned narration alignment / asset cues
  -> build deterministic ASS subtitle track (build_subtitle_track)
  -> normalize beat durations against narration duration
  -> calculate render_fingerprint (image-motion-render-v5-admission-snapshot-drive-lock)
  -> FFmpeg IMAGE_MOTION render with burned ASS subtitles (-vf subtitles=subtitles.ass) in local workspace
  -> ffprobe MP4 duration and stream validation
  -> calculate local SHA-256 checksum
  -> acquire session-scoped PostgreSQL advisory lock (render_fingerprint_lock)
  -> Google Drive put_immutable:
       - find existing file by renderFingerprint
       - verify remote size and narrativexSha256 appProperty match local checksum
       - if absent, start resumable chunked upload with custom appProperties
       - verify uploaded file metadata matches local SHA-256
  -> commit render_manifest + final_artifacts
  -> mark render stage and job COMPLETED
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

The Drive file ID, not the web-view URL, is the remote object identity. Final video bytes are not written to R2.

### Retry semantics & integrity

1. **Admission snapshot isolation:** Since the render worker reads strictly from `render_input_snapshots`, subsequent edits to MediaPlans or assets cannot corrupt a running or retried render job.
2. **PostgreSQL advisory lock:** Cross-worker advisory lock on the render fingerprint serializes Drive upload and FinalArtifact persistence, preventing duplicate parallel uploads.
3. **Idempotent remote reuse:** If a previous worker attempt succeeded in uploading to Drive before a transient failure or crash, subsequent attempts search by `renderFingerprint`, verify the SHA-256 checksum, and reuse the remote file without re-uploading.
4. **Ephemeral workspace boundary:** The local workspace `chapter.mp4` is ephemeral. If a job is marked `STALLED` and reclaimed by another worker attempt, the local FFmpeg render will re-execute locally before verifying/reusing the remote Drive file. Preserving a validated local MP4 across job attempts is a TARGET hardening item.

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

This split is governed by [ADR-0003](../decisions/ADR-0003-media-storage-generation-pipelines-and-external-integrations.md) and supersedes earlier single-store R2 assumptions.

---

## 17. Remaining release-critical work

1. Harden user-provided audio upload/finalize/alignment and connect aligned multi-part audio to render slicing/stitching.
2. Complete narration-driven `VisualScenePlanner` and review/approval workflow.
3. Harden image review/reuse/lineage and affected-scope regeneration.
4. Add publishing/entitlement hardening around the existing backend-authorized preview/download/streaming for Google Drive final artifacts.
5. Preserve validated local renders across Drive retry attempts or materialize a durable upload-stage boundary if rerender avoidance is required.
6. Complete actual usage/billing reconciliation and release/refund behavior.
7. Add production health/configuration checks for Drive credentials and storage availability.
8. Complete moderation, SSRF, retention/deletion, observability and disaster-recovery evidence.
9. Add social publishing through a provider-neutral final-video read/stream boundary without making Drive files public.

---

## 18. Documentation rules

- This V1.11 file is the single maintained versioned source of truth.
- Do not recreate V1.10/V1.9 as parallel current specs.
- [ADR-0001](../decisions/ADR-0001-system-topology-execution-and-persistence.md) through [ADR-0004](../decisions/ADR-0004-authentication-runtime-security-and-test-credentials.md) record consolidated architectural decisions.
- Current code decides AS-IS claims; target architecture must be explicitly labeled TARGET.
- Derived docs must not claim `R2-only`, `R2 FinalArtifact`, unfinished image generation, or unfinished Google Drive final storage after this checkpoint.
- Derived docs must also not claim that multi-part uploaded narration rendering or cross-attempt Drive upload retry is complete until code proves it.
