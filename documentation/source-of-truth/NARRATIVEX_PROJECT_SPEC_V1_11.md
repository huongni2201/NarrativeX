# NarrativeX — Project Source of Truth V1.11

**Status:** Canonical engineering direction and code-aligned baseline  
**Effective date:** 21/08/2026  
**Repository:** `huongni2201/NarrativeX`  
**Docs-sync base:** `main` at `69d5ecdeffdb5e01e0631dbdc2709f207f890044`  
**Supersedes:** V1.10 as the planning baseline for new work

---

## 1. Authority and status semantics

V1.11 is the maintained product/domain/architecture baseline. Accepted ADRs refine cross-cutting decisions. Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims when a derived document drifts.

Status vocabulary:

- **IMPLEMENTED** — merged and backed by code/tests at the documented checkpoint.
- **PARTIAL** — a usable foundation exists but the complete product workflow is not proven.
- **TARGET** — approved next implementation direction.
- **DEFERRED** — intentionally postponed until the core creator loop is reliable.

Roadmap intent must never be presented as implemented behavior.

---

## 2. Product definition

NarrativeX is an AI-assisted long-form story-video studio. It transforms persisted Chapter source into structured analysis, continuity-aware visual plans, durable media assets and final long-form video.

The product is:

- **chapter-first** — Chapter is the primary authoring/source unit;
- **review-first** — generated state is inspectable/versioned instead of silently replacing approved history;
- **audio-timeline-first** — narration timing is authoritative for visual duration;
- **image-first** — deterministic image motion is the default first complete video path;
- **durable-by-design** — PostgreSQL owns authoritative state and Cloudflare R2 owns durable media bytes;
- **backend-authorized** — workers execute persisted plans and may not invent paid work.

Creating a Project only persists metadata. Saving a Chapter only persists source. Analyze, narration/audio processing, image generation and rendering are explicit operations.

---

## 3. Non-negotiable invariants

### 3.1 Source preservation

Expensive work must pin the authoritative source identity:

```text
chapterId
chapterRowVersion
sourceHash
```

When needed, the exact source text snapshot is carried as part of the durable request. A later Chapter edit creates a new source identity. Historical approved/generated outputs are not rewritten in place.

### 3.2 Narration is not synonymous with TTS

Code-aligned strategy vocabulary:

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

If accepted user-provided audio covers the selected scope, NarrativeX must not generate or reserve TTS for that same narration scope. The accepted audio is aligned to the exact selected source and its resulting timeline becomes visual timing authority.

### 3.3 Audio file boundaries are not Chapter boundaries

A user may select many Chapters and provide one continuous audio file or several ordered audio files. One file may cover multiple Chapters and several files may cover a single selected range.

The durable model is an ordered narration set/bundle plus one logical global audio clock. Alignment maps source spans to global audio spans.

### 3.4 Backend owns execution policy

The backend creates/version-controls the authorized `MediaPlan`, including `ProductionMode`, resolved `MotionStrategy`, workload and cost/reservation context. A `GenerationJob` pins the exact plan revision.

The worker executes that persisted plan. It may validate, reconcile, retry or fall back only inside the authorized contract. It must not silently escalate deterministic motion to I2V.

### 3.5 Durable media means R2

Cloudflare R2 is the sole durable binary-media store across environments. PostgreSQL stores metadata, checksums, keys and lineage. Worker-local files are scratch/cache/FFmpeg workspace only.

A local path or provider URL is never an authoritative durable asset identity.

### 3.6 Persistence converges on MyBatis

Strategic backend persistence is:

```text
technology-neutral application/domain ports
  -> MyBatis infrastructure adapters
  -> explicit row models + explicit mapper XML/SQL
  -> PostgreSQL
```

The migration is complete: production persistence uses MyBatis + explicit SQL, the build has no JPA dependency, and production code has no `JdbcTemplate`. Architecture tests prevent regression.

---

## 4. Current implementation baseline

| Capability | V1.11 state | Notes |
|---|---|---|
| Project/Chapter authoring | IMPLEMENTED foundation | Project and Chapter persistence are MyBatis-backed |
| Project dashboard/favorite | IMPLEMENTED foundation | backend dashboard/favorite contracts and live frontend wiring exist |
| Chapter Analyze | IMPLEMENTED | durable admission/enqueue and worker execution |
| Worker claim/lease/heartbeat | IMPLEMENTED | PostgreSQL-backed and bounded |
| ProviderOperation durability | IMPLEMENTED foundation | reconciliation/result immutability foundation exists |
| Generation execution persistence | IMPLEMENTED for covered durability boundaries | GenerationJob, StageAttempt, OperationPlan, MediaPlan, outbox enqueue and Job History use MyBatis/explicit SQL; Chapter Analyze has no internal pre-moderation gate |
| Character + Location continuity | IMPLEMENTED foundation | full human review/reference lock remains partial |
| Project Character list/detail | IMPLEMENTED foundation | project-scoped authoritative read model is wired end to end; richer relationships/assets/scene detail remain partial |
| Scene + VisualBeat | IMPLEMENTED foundation | broader edit/version-reset remains partial |
| Backend-authoritative MediaPlan | IMPLEMENTED foundation | immutable revision and job pinning exist |
| Motion execution policy | IMPLEMENTED foundation | worker does not own strategy selection |
| Full-chapter TTS narration | IMPLEMENTED foundation | source-preserving provider path |
| Narration alignment | IMPLEMENTED foundation | source/audio spans with timing |
| R2-backed narration media | IMPLEMENTED foundation | immutable durable media topology |
| `USER_PROVIDED_AUDIO` strategy | IMPLEMENTED foundation | ordered parts, fingerprints, global clock, TTS bypass |
| Multi-file / multi-Chapter logical timeline | IMPLEMENTED foundation | file boundaries do not define Chapters |
| Production upload/finalize + real user-audio alignment path | PARTIAL | foundation exists; user-facing durable flow needs hardening |
| MyBatis-only production persistence | IMPLEMENTED | all production adapters use MyBatis + explicit SQL; architecture tests prevent JPA/`JdbcTemplate` regression |
| VisualScenePlanner | TARGET | narration-driven adaptive visual planning |
| Production image generation | TARGET | first slice may use `GENERATE_NEW` only |
| Minimal immutable image MediaAsset lifecycle | TARGET | required before renderer completion |
| IMAGE_MOTION render/export | TARGET | first complete long-form MP4 path |
| Reuse/reframe/edit AssetResolver | DEFERRED fast-follow | optimize after first reliable MP4 |
| HYBRID_LOCAL_I2V end-to-end | DEFERRED fast-follow | selected-beat private I2V |
| Complete actual-cost reconciliation | PARTIAL | reservation exists; full ledger/release remains |

The outbox dispatcher claim/lease path uses a dedicated MyBatis mapper.

---

## 5. Canonical topology and authority

```text
Browser / Next.js Studio
        |
        v
Spring Boot Backend
  -> PostgreSQL      authoritative domain/job/plan/usage metadata
  -> Redis           Spring Session + transient/non-authoritative hints
  -> Cloudflare R2   private durable media bytes
        |
        v
Python AI / Media Worker
  -> provider adapters
  -> narration/alignment execution
  -> image/media execution
  -> optional I2V execution
  -> FFmpeg scratch/render
  -> validation + R2 promotion
```

PostgreSQL owns source versions, domain state, plans, jobs, stages, provider operations, reservations/usage metadata and media lineage. Redis must never be the only record of generation correctness.

---

## 6. Durable execution contract

The execution spine is:

```text
Source Snapshot / Reviewed State
  -> OperationPlan / MediaPlan
  -> GenerationJob
  -> StageAttempt
  -> ProviderOperation when crossing provider/external execution
  -> validated result
  -> R2 media bytes + PostgreSQL metadata
  -> terminal durable stage/job state
```

Long network/provider calls must not hold long business database transactions open. Stage lease/heartbeat state is durable. A worker that loses its lease cannot finalize successful output for that lease.

---

## 7. ProviderOperation invariants

Provider execution is a money/content boundary.

High-level lifecycle:

```text
RESERVED
  -> SUBMITTED
  -> RUNNING
  -> COMPLETED | FAILED

ambiguity/timeout
  -> UNKNOWN
  -> reconcile before any resubmit
```

Rules:

- persist stable request identity before crossing the external boundary;
- state transitions use expected-state/version predicates rather than unguarded overwrite;
- ambiguous outcome becomes `UNKNOWN`, never blind retry;
- retries/reconciliation reuse the original deterministic request identity;
- terminal completed/failed state does not reopen;
- `COMPLETED + same result_fingerprint` is idempotent;
- a different completed result fingerprint is an invariant conflict;
- a durable valid result may be replayed into materialization after a crash without another provider call.

---

## 8. Narration architecture

### 8.1 Generated TTS

```text
persisted exact Chapter source
  -> deterministic NarrationRequest
  -> TTS provider
  -> durable provider execution
  -> narration segment/final audio
  -> validate
  -> R2
  -> immutable narration metadata
  -> alignment
```

Provider segmentation may exist for provider limits/retry safety, but segmentation is sentence/paragraph oriented and must not be coupled to visual-scene boundaries.

### 8.2 User-provided audio

```text
selected Chapter revision/source manifest
  + ordered audio parts (1..N)
  -> document/narration fingerprints
  -> one logical global audio clock
  -> alignment spans
  -> alignment status/coverage/confidence
  -> visual planning
```

The production ingestion boundary must authorize a private R2 upload/finalize path, validate media type/decode/duration/size/checksum, persist immutable MediaAsset metadata and only then admit the part to alignment/rendering.

Unsupported/corrupt audio fails before downstream paid work. Original uploads remain immutable; normalized/derived media is a new asset with lineage.

### 8.3 TTS bypass

For a covered `USER_PROVIDED_AUDIO` scope:

```text
DO analyze/reuse valid analysis
DO align user audio
DO build visual plan
DO generate/resolve images
DO render using user-audio timeline
DO NOT schedule TTS_GENERATE
DO NOT reserve/charge TTS character workload
```

If alignment is below configured acceptance thresholds, stop for review/fix rather than silently generating replacement TTS.

---

## 9. Visual planning and timing authority

Visual planning consumes source/analysis/continuity plus the narration timeline:

```text
source + analysis/storyboard + continuity
              +
       narration alignment
              |
              v
      VisualScenePlanner
              |
              v
       VisualScenePlan[]
```

A visual scene should pin semantic/source identity and timing (`sourceTextSpan`, `audioSpan`) plus visual intent, character/location/reference snapshot refs, asset strategy and motion strategy.

The concatenated visual timeline must cover narration without accidental source/audio gaps. A plan must never combine alignment from source version A with incompatible storyboard/media state from source version B.

---

## 10. Production modes

Code-aligned vocabulary:

```text
ProductionMode
  IMAGE_MOTION
  HYBRID_LOCAL_I2V

MotionStrategy
  BASIC_IMAGE_MOTION
  IMAGE_TO_VIDEO
```

`IMAGE_MOTION` authorizes deterministic image motion only and never I2V. It is the first complete low-cost production target.

`HYBRID_LOCAL_I2V` remains image-first. Only selected authorized scenes may use private/self-hosted I2V; other scenes use deterministic motion. The initial adapter may target a Wan-compatible endpoint, but provider/model identity must remain outside product-domain branching.

---

## 11. Image asset strategy

Long-term asset resolution remains reuse-first:

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

For the first reliable V1.11 media vertical slice, `GENERATE_NEW`-only image execution is allowed. This is delivery sequencing, not a reversal of reuse-first architecture.

After the first durable MP4, add approved lookup, continuity/reference compatibility, deterministic crop/reframe, edit-existing, lineage and affected-scope invalidation.

---

## 12. Image generation durability

Production image execution follows the same provider rules as analysis/TTS:

```text
planned image operation
  -> authorization/reservation
  -> ProviderOperation
  -> submit/reconcile/fetch
  -> worker scratch
  -> validate media payload
  -> upload immutable bytes to R2
  -> persist MediaAsset metadata
  -> review/moderation/identity state
  -> stage complete
```

At minimum validate media type/decode, non-zero dimensions, checksum/content hash, aspect/crop policy, provider schema, R2 persistence and metadata commit.

Provider success alone does not complete the stage.

---

## 13. Minimal immutable MediaAsset before rendering

The renderer must not depend on ephemeral local image paths. The first media loop needs an immutable asset contract containing at least:

```text
MediaAsset
  id
  projectId
  mediaType
  r2ObjectKey
  checksum/contentHash
  mimeType
  sizeBytes
  width/height OR durationMs
  source/provider lineage
  createdAt
```

Approval/derivation metadata can grow later, but durability cannot be postponed until after rendering.

---

## 14. First complete render path

The first end-to-end V1.11 target is:

```text
selected Chapter scope
  -> current analysis/review state
  -> TTS or USER_PROVIDED_AUDIO aligned timeline
  -> VisualScenePlan[]
  -> durable image MediaAssets
  -> IMAGE_MOTION deterministic render
  -> chapter/segment video
  -> merge
  -> validate FinalArtifact
  -> private R2 final object
  -> preview/download via backend-authorized access
```

Visual duration comes from narration spans. Scene/chapter rendering may be incremental to bound memory/disk usage.

FinalArtifact readiness requires successful decode/container/MIME validation, positive duration, expected dimensions/resolution, required audio stream, duration tolerance against the narration plan, checksum and R2 persistence.

---

## 15. Cost, reservation and actual usage

NarrativeX distinguishes:

```text
expectedCost
reservationCeiling
actualCost
```

Semantic/media planning outputs workload units, not hardcoded dollars per scene. Versioned provider pricing and versioned GPU benchmark snapshots convert workload to estimates/reservations.

For `USER_PROVIDED_AUDIO`, TTS character workload is zero for the covered scope, while storage/alignment/image/motion/render workload may still be metered.

After execution, append actual usage and consume/release unused reservation according to the billing contract. Self-hosted I2V economics are based on measured GPU compute for a versioned model/hardware/resolution/inference profile, not a universal static price.

---

## 16. Review, history and continuity

Character is reusable identity; ProjectCharacter is project participation/context. Appearance/outfit changes do not create a new Character identity. Downstream media should resolve reviewed/versioned Character/reference snapshots.

Project-scoped Character list/detail reads are now authoritative for their exposed fields. This read-model completion must not be confused with full Character version locking/reference approval: relationship graphs, asset aggregation and detailed scene participation remain incomplete until backed by explicit contracts.

Re-analysis must not destructively replace approved Storyboard history. Regeneration creates new attempts/assets and preserves previous durable outputs for audit/review.

When source/character/location/storyboard inputs change, prefer affected-scope invalidation/regeneration rather than rebuilding unrelated work.

---

## 17. Security, access and media ingestion

V1.11 release expectations include:

- private R2 objects by default;
- backend-authorized/presigned access instead of persistent public media URLs;
- strict uploaded-media validation;
- SSRF-safe policy for any server/worker remote fetch capability;
- input/output moderation and abuse controls before public beta;
- tenant-scoped identity/reference data;
- deletion/retention covering PostgreSQL metadata and R2 objects;
- correlation across Job → StageAttempt → ProviderOperation → MediaAsset/FinalArtifact.

Provider output and uploaded/user content are untrusted data until application validation succeeds.

---

## 18. MyBatis migration direction

Current MyBatis/explicit-SQL production boundaries include:

- ProviderOperation;
- Chapter;
- Project command/query persistence;
- GenerationJob;
- StageAttempt;
- OperationPlan;
- MediaPlan;
- generation outbox enqueue persistence;
- Job History;
- Chapter Analyze durable admission and enqueue.

The outbox dispatcher claim/lease path uses a dedicated MyBatis mapper.

Preferred remaining order:

1. StoryVersion.
2. Reservation / usage / billing boundaries.
3. Scene / VisualBeat / revision persistence.
4. Character / ProjectCharacter / Location continuity write persistence.
5. Remaining low-risk CRUD/read-query boundaries.
6. Remove unused JPA entities/repositories/config and residual direct JDBC wrappers after evidence.

Migration rules:

- application/domain ports stay persistence-neutral;
- dedicated infrastructure row models;
- explicit mapper XML/result maps/column lists;
- semantic mapper operations such as `claim`, `transition`, `reserve`, `reconcile`;
- SQL CAS using expected `row_version`/allowed state where applicable;
- zero affected rows on guarded update becomes conflict, not silent success;
- one Spring DataSource/transaction boundary;
- PostgreSQL Testcontainers evidence for PostgreSQL-specific behavior.

---

## 19. Implementation order

Two workstreams proceed together.

### Track A — platform simplification

Completed checkpoint:

```text
DONE ProviderOperation MyBatis
DONE Chapter MyBatis
DONE Project command/query MyBatis
DONE GenerationJob / StageAttempt / OperationPlan / MediaPlan durable persistence
DONE generation outbox enqueue / Job History migration; Chapter Analyze internal pre-moderation gate removed
```

Remaining order:

```text
A1 StoryVersion MyBatis
A2 reservation / usage / billing migration
A3 Storyboard / continuity persistence migration
A4 remaining CRUD/query migration
A5 remove unused JPA/JDBC infrastructure after tests prove cutover
A6 keep docs-drift/architecture tests synchronized
```

### Track B — first complete creator loop

```text
B1 TTS | USER_PROVIDED_AUDIO strategy          IMPLEMENTED foundation
B2 ordered multi-file logical narration clock IMPLEMENTED foundation
B3 uploaded-audio TTS bypass planning         IMPLEMENTED
B4 production upload/finalize + alignment     TARGET/PARTIAL hardening
B5 VisualScenePlanner                          TARGET
B6 production image generation                TARGET
B7 immutable R2 image MediaAsset              TARGET
B8 IMAGE_MOTION FFmpeg render                 TARGET
B9 validated R2 FinalArtifact                 TARGET
```

Fast-follow after the first durable MP4:

- Character review/reference locking completion;
- approved Storyboard revision/reset workflow;
- reuse/reframe/edit AssetResolver;
- durable media-stage recovery hardening;
- HYBRID_LOCAL_I2V/Wan hardening;
- full actual-cost ledger/reconciliation;
- moderation/SSRF/retention/observability/DR evidence;
- richer UI mode/cost comparison.

---

## 20. First playable-video acceptance

The first vertical slice is accepted when the system proves this scenario end-to-end:

```text
Given:
  persisted project
  10 selected Chapters
  one valid user narration file OR several ordered audio parts
  no TTS requested

When:
  current analysis is produced/reused
  user audio is validated and durable in R2
  audio is aligned to selected source
  VisualScenePlan is built from the narration timeline
  images are generated and durable in R2
  IMAGE_MOTION render executes

Then:
  TTS provider is never called for the covered scope
  every planned visual span references valid audio timing
  images are durable MediaAssets, not local paths
  final MP4 validates and persists to R2
  PostgreSQL reconstructs job/plan/provider/media lineage
  worker restart does not unnecessarily regenerate valid durable media
```

A corresponding TTS acceptance scenario must feed the same downstream planner/render contracts.

---

## 21. Generic media-stage definition of done

```text
provider/local execution completes
  -> materialize bytes
  -> validate bytes + metadata
  -> upload immutable object to R2
  -> persist authoritative metadata/lineage in PostgreSQL
  -> reconcile usage/reservation when required
  -> mark stage complete
```

A retry/reclaim path should reuse an already-valid R2 asset rather than regenerate it solely because scratch was lost.

---

## 22. Retired assumptions

| Retired assumption | V1.11 rule |
|---|---|
| Worker-local path is a durable asset | Forbidden |
| Narration always means TTS | User-provided audio is first-class |
| One audio file must equal one Chapter | Retired |
| Visual scenes own TTS segmentation | Narration timeline drives visual timing |
| Worker decides I2V | Backend MediaPlan authorizes execution |
| Every beat should use generative video | Image-first is the default economics |
| Full reuse engine must block first video | `GENERATE_NEW` MVP is allowed |
| Completed provider result can be overwritten | Forbidden except same-fingerprint idempotency |
| `UNKNOWN` can be blindly resubmitted | Forbidden |
| New persistence should expand JPA/JDBC | Converge on MyBatis |
| Vendor prices belong in Source of Truth | Use versioned pricing/benchmark data |
| Project Character UI may fabricate missing backend fields | Forbidden; render unavailable state until an authoritative read model exists |

---

## 23. Documentation/CI drift rules

Current-state docs and CI should detect at least:

- stale links presenting V1.10 or older baselines as current authority;
- stale TTS-only narration assumptions;
- claims that uploaded narration is target-only after the foundation merged;
- stale worker-owned production-mode resolution;
- contradictory `IMAGE_MOTION` / `HYBRID_LOCAL_I2V` vocabulary;
- stale persistence status after MyBatis migrations;
- stale claims that generation execution persistence is still a future migration;
- reintroduction of non-R2 durable-media assumptions;
- runtime Character fixtures presented as authoritative project data;
- roadmap statuses that no longer match merged code.

---

## 24. V1.10 → V1.11 direction summary

V1.11 promotes backend-authoritative MediaPlan, full-chapter narration/alignment, R2-only durable narration, ProviderOperation/Chapter/Project plus generation-execution MyBatis foundations and stronger provider-result invariants into the maintained baseline.

It adds first-class `USER_PROVIDED_AUDIO`, variable-count audio bundles across arbitrary selected Chapter scopes, TTS bypass for covered user-audio scopes, alignment-driven visual timing, full MyBatis convergence and a first durable `IMAGE_MOTION` MP4 vertical slice.

The current checkpoint additionally includes project-scoped Character list/detail read models wired end to end, while full Character reference locking/relationship/asset-detail workflows remain follow-up work.

Full reuse/reframe/edit optimization and HYBRID_LOCAL_I2V are fast-follow rather than blockers for the first playable long-form video.

---

## 25. Final engineering rule

Prefer the **smallest correct vertical slice** that reaches a real durable video, but never bypass:

- authoritative source snapshots;
- backend execution authorization;
- durable/idempotent ProviderOperation handling;
- immutable completed results;
- R2 durability before media-stage success;
- narration timeline authority;
- no TTS for accepted user-provided narration scope;
- explicit SQL/CAS concurrency semantics;
- PostgreSQL-backed recoverability;
- no silent paid-work escalation;
- no fabricated runtime business data where an authoritative backend read model is absent.

Richer reuse, advanced I2V, multi-provider optimization, full timeline editing and other improvements are layered on after the core creator loop is reliable.
