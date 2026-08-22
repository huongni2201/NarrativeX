# NarrativeX — Product Specification V1.11

**Status:** maintained product contract  
**Canonical source:** [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md)  
**Implementation evidence:** [`../TRACEABILITY.md`](../TRACEABILITY.md)

Accepted ADRs refine cross-cutting decisions. ADR-0016 supersedes the previous R2-only rule specifically for final rendered MP4 exports.

## Product definition

NarrativeX is an AI-assisted long-form story-video studio. It is chapter-first, review-first, audio-timeline-first, image-first, backend-authorized and durable-by-design.

Project creation is metadata-only. Saving Chapter source does not implicitly run AI. Analysis, narration selection/processing, image generation and rendering are explicit operations.

## Current implementation snapshot

Implemented foundations now include:

- Project, StoryVersion and Chapter authoring foundations plus project dashboard/favorite reads;
- MyBatis/explicit-SQL persistence for ProviderOperation, Chapter, Project and covered generation durability boundaries: GenerationJob, StageAttempt, OperationPlan, MediaPlan, generation outbox enqueue and Job History; Chapter Analyze has no application-owned pre-moderation gate;
- durable Chapter Analyze admission, reservation, enqueue and worker execution;
- ProviderOperation reconciliation/result-fingerprint invariants;
- Character/Location continuity and Scene/VisualBeat materialization;
- project-scoped Character list/detail reads wired end to end without fabricated runtime business fields for covered data;
- backend-authoritative immutable/versioned MediaPlan foundation;
- full-chapter TTS narration, alignment and R2 persistence;
- user-provided narration planning/timeline foundation with ordered multi-file audio and TTS bypass;
- job history/quota/notification and frontend studio foundations;
- R2 durable storage contract for source/generated/reusable pipeline media.

Google Drive final-video storage is the approved target architecture but remains implementation work until the render/export slice lands.

Production persistence is fully MyBatis + explicit SQL, including outbox claim/lease. The JDBC driver and transaction manager remain lower-level infrastructure only.

## Narration contract

Narration has two product strategies:

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

`USER_PROVIDED_AUDIO` is not one-file-per-Chapter. One file may cover many Chapters, or several ordered files may cover the same selected Chapter range. NarrativeX builds one logical audio clock and aligns source spans to that timeline. For the covered scope, TTS generation and TTS reservation are omitted.

A production-ready upload path must validate/finalize immutable R2-backed audio assets before they can drive alignment/rendering.

## Media planning contract

The backend owns the authorized immutable `MediaPlan` and resolved `MotionStrategy`. The worker executes the persisted plan and may only fall back within authorized policy.

```text
ProductionMode
  IMAGE_MOTION
  HYBRID_LOCAL_I2V

MotionStrategy
  BASIC_IMAGE_MOTION
  IMAGE_TO_VIDEO
```

`IMAGE_MOTION` never schedules I2V. `HYBRID_LOCAL_I2V` may authorize selected I2V scenes but remains image-first.

## Storage contract

NarrativeX intentionally separates pipeline media from final-video retention:

```text
Cloudflare R2
  -> generated images/keyframes
  -> narration/audio
  -> thumbnails
  -> uploaded/reusable pipeline media

Google Drive via FinalVideoStorage
  -> final rendered MP4 exports
```

PostgreSQL owns metadata and logical storage identity. Local paths and public provider URLs are never authoritative asset identities.

The final MP4 is rendered to worker-local scratch, validated, uploaded with resumable semantics, verified remotely, then recorded as `READY`. Local cleanup occurs only after durable remote verification and metadata commit. An upload failure retries upload rather than rerendering an already-valid final file.

## V1.11 delivery order

The first complete media loop prioritizes correctness and time-to-first-video:

```text
Chapter source / reviewed analysis
  -> TTS or USER_PROVIDED_AUDIO narration timeline
  -> VisualScenePlanner
  -> GENERATE_NEW image execution for MVP
  -> immutable R2 MediaAsset
  -> deterministic IMAGE_MOTION render to local scratch
  -> validate final MP4
  -> Google Drive FinalVideoStorage upload + verify
  -> validated FinalArtifact metadata in PostgreSQL
```

Reuse/reframe/edit asset resolution remains the long-term cost/consistency strategy, but it is a fast-follow after the first reliable MP4.

## Current versus target media scope

| Capability | Status |
|---|---|
| Chapter analysis | IMPLEMENTED |
| Character/Location analysis continuity | IMPLEMENTED foundation |
| Project Character list/detail read model | IMPLEMENTED foundation |
| Backend-authoritative MediaPlan | IMPLEMENTED foundation |
| TTS narration + alignment + R2 media | IMPLEMENTED foundation |
| User-provided narration plan/timeline + TTS bypass | IMPLEMENTED foundation |
| Production upload/finalize + real uploaded-audio alignment path | PARTIAL |
| Character version/reference/lock review | PARTIAL |
| Approved storyboard reset/versioning | PARTIAL |
| VisualScenePlanner | TARGET |
| Production image generation | TARGET |
| Minimal immutable image MediaAsset lifecycle | TARGET |
| IMAGE_MOTION render/export | TARGET |
| Google Drive `FinalVideoStorage` resumable upload + verification | TARGET |
| Reuse/reframe/edit AssetResolver | DEFERRED fast-follow |
| HYBRID_LOCAL_I2V end-to-end | DEFERRED fast-follow |
| Complete billing/actual-usage reconciliation | PARTIAL |

## Acceptance direction

```text
Persisted Chapter scope
  -> analysis/review state
  -> narration strategy + aligned timeline
  -> authorized MediaPlan
  -> durable R2 visual/audio assets
  -> deterministic motion/video execution
  -> validated local final MP4
  -> Google Drive upload + verification
  -> immutable READY FinalArtifact metadata
```

A provider success response alone never makes a media stage complete. Pipeline media must be validated and persisted to R2 with authoritative PostgreSQL metadata. Final rendered video must be validated locally, durably stored and verified through `FinalVideoStorage`, then committed to PostgreSQL before it is `READY`.

Detailed V1.11 feature/status inventory: [FEATURE_CATALOG.md](FEATURE_CATALOG.md).
