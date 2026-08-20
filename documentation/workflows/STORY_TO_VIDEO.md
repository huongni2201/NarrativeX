# Story-to-Video Workflow

This is the Chapter-first long-form image-first workflow for NarrativeX V1.10. Duration, Chapter size and visual count are adaptive; the system does not assume a fixed video duration or fixed image count.

## Entry flow

Creating a Project persists metadata/defaults only. Saving a Chapter persists source only. AI work starts only from an explicit Analyze action.

```text
Authenticated owner
  -> Create Project metadata
  -> Add/Edit Chapter source
  -> persist sourceText/sourceHash/rowVersion
  -> explicit Analyze Chapter
  -> durable Chapter pipeline
```

Canonical request:

```http
POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs
```

The backend reloads the persisted Chapter and snapshots the saved source. Browser text is not the analysis authority.

## Current implemented Chapter Analyze path

```text
saved Chapter
  -> ownership + Project/Chapter/StoryVersion validation
  -> idempotency
  -> persisted safety decision gate
  -> storyAnalysis entitlement
  -> concurrent-expensive-job check
  -> monthly-credit check + atomic UsageWindow reservation
  -> OperationPlan with non-zero estimate/cap
  -> GenerationJob + StageAttempt + OutboxEvent
  -> COMMIT
  -> Redis best-effort delivery hint
  -> PostgreSQL worker claim/lease/heartbeat
  -> ProviderOperation RESERVED before external submit
  -> provider SUBMITTED/RUNNING/COMPLETED | FAILED | UNKNOWN
  -> UNKNOWN reconciliation before blind resubmit
  -> structured Chapter analysis
  -> transactional materialization
  -> GenerationJob COMPLETED
```

PostgreSQL is authoritative. Redis is only a non-authoritative wake-up/delivery hint.

## Materialization boundary

Currently materialized:

- `Character`
- `CharacterVersion`
- `ProjectCharacter`
- `Scene`
- `VisualBeat`

The structured AI result also contains Locations and per-Scene character/location references, but current materialization does **not** yet persist:

- AI-returned Locations;
- Scene -> ProjectCharacter relations;
- Scene -> Location relation.

This continuity gap is P1 because downstream visual generation cannot reliably reconstruct which approved character identity and environment belong to each Scene.

## Worker throughput

A worker process supports bounded configurable concurrency using `WORKER_CONCURRENCY`:

- default: `4`;
- allowed: `1..32`;
- PostgreSQL claims use `FOR UPDATE ... SKIP LOCKED`;
- StageAttempt lease/heartbeat prevents duplicate active ownership;
- asyncpg pool sizing follows configured concurrency;
- graceful shutdown stops new claims and waits for in-flight jobs.

## Re-analysis safety

Before materialization the worker verifies that persisted Chapter identity still matches the job snapshot:

```text
chapterId + storyVersionId + rowVersion + sourceHash
```

Unapproved generated Storyboard rows may currently be replaced destructively on re-analysis. If an existing Scene or VisualBeat is already approved, replacement is rejected. An explicit reset/versioning workflow is still required to evolve approved output safely.

## Chapter Workspace read path

Chapter Workspace uses an outbound read repository instead of application-layer JDBC. Its PostgreSQL adapter uses an aggregate query plus a bounded preview query. `sourceOutdated=true` when the latest analysis source hash differs from the current Chapter source.

## Durable outbox behavior

The enqueue transaction persists durable job state and outbox intent before any Redis call. The dispatcher reserves eligible PENDING outbox rows in a short PostgreSQL transaction, commits, then publishes to Redis. Redis latency therefore does not hold database row locks. Failed publishes are retried; duplicate hints are harmless because PostgreSQL job state is authoritative.

## Provider durability

Chapter Analyze already persists ProviderOperation state. A stable request fingerprint is reserved before the external provider boundary. Supported lifecycle states are:

```text
RESERVED -> SUBMITTED -> RUNNING -> COMPLETED
                         \-> FAILED
                         \-> UNKNOWN -> reconcile
```

`UNKNOWN` is an ambiguity state, not permission to submit again blindly.

## Target audio-first media workflow

For source-preserving narration, the persisted Chapter source remains narration content authority. Do not split and independently rewrite/synthesize every visual scene by default.

```text
persisted Chapter sourceText
  -> TTS full Chapter text without rewriting
  -> Chapter narration asset
  -> word/sentence alignment timestamps
  -> adaptive VisualScenePlan[] against narration spans
  -> reuse/reframe/edit/new-keyframe planning
  -> production-mode routing
  -> bounded Chapter render
```

The narration timeline is visual timing authority. Visual scenes are adaptive: a reaction can be short while exposition or inner monologue can hold a compatible visual longer. A generated motion clip can also be shorter than its narration span and be extended using deterministic composition.

## Two production modes

NarrativeX target media planning supports:

```text
IMAGE_MOTION
  -> reuse/reframe/edit/generate keyframes
  -> deterministic pan/zoom/parallax/effects only
  -> zero I2V operations

HYBRID_LOCAL_I2V
  -> same image-first/reuse-first workflow
  -> SIMPLE scenes use deterministic motion
  -> selected MEDIUM/COMPLEX scenes may use private/self-hosted I2V
  -> deterministic fallback when authorized
```

Production mode is provider-neutral. The first worker adapter targets a Wan2.2-compatible endpoint, but model/vendor identity does not belong in story-domain branching. See `LOCAL_I2V.md` and ADR-0012.

The reuse order is:

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

Only billable/new work contributes provider cost; reuse and deterministic derivation reduce the workload and improve continuity.

## Post-analysis cost planning

Semantic analysis produces workload metrics, not a hardcoded video price. A valid analysis snapshot can be re-planned for both production modes without another story-analysis provider call when only production policy changes.

Example workload dimensions include:

```text
chapterCount
sourceCharacters / ttsCharacters
narrationSeconds
visualSceneCount
newImageCount
imageEditCount
reuseOrReframeCount
basicMotionSceneCount
plannedI2vSceneCount
plannedI2vOutputSecondsByResolution
finalRenderSeconds
storage/egress estimates
```

The backend cost authority combines these units with versioned `PricingSnapshot` and, for self-hosted I2V, versioned GPU benchmark snapshots. `expectedCost`, `reservationCeiling` and reconciled `actualCost` are separate values. Do not hardcode a Wan dollars-per-scene constant: local I2V cost depends on measured GPU seconds for the selected hardware/model/resolution/inference profile.

## End-to-end product target

The broader V1.10 target extends the implemented analysis slice:

```text
session + ownership
  -> Chapter source
  -> safety/consent/injection defenses
  -> CHAPTER_ANALYZE
  -> durable characters + locations + scene continuity
  -> Character review/lock
  -> TTS preserved Chapter source + narration alignment
  -> VisualScene plan
  -> production-mode + full operation/cost planning
  -> approved reference/keyframe assets + reuse lineage
  -> IMAGE_MOTION deterministic motion
     or HYBRID_LOCAL_I2V selected-beat local I2V
  -> identity/output QA + visual review
  -> bounded scene/chapter render
  -> merge Chapters + subtitle/BGM/SFX
  -> FinalArtifact validation
  -> export + notification
```

## Current production gaps

Public-production readiness still requires:

1. Location and Scene continuity materialization.
2. Explicit approved-storyboard reset/versioning.
3. Full pricing/actual-provider-and-internal-resource usage accounting, unused reservation release and billing-ledger reconciliation.
4. Broader automated moderation, consent and abuse-policy coverage.
5. Full-Chapter TTS/alignment, reuse-first image pipeline, deterministic motion render and FinalArtifact validation.
6. Durable media-stage wiring around the local I2V adapter plus real GPU benchmark/usage capture.
7. Real-provider/runtime failure/restart/reconciliation E2E coverage.
8. Production observability, backup/restore and deletion lifecycle evidence.
