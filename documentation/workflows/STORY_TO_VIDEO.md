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

## End-to-end product target

The broader V1.10 target extends the implemented analysis slice:

```text
session + ownership
  -> Chapter source
  -> safety/consent/injection defenses
  -> CHAPTER_ANALYZE
  -> durable characters + locations + scene continuity
  -> Character review/lock
  -> VisualBeat plan
  -> full operation/cost planning
  -> approved reference assets
  -> image generation + identity QA + visual review
  -> TTS narration + subtitle timing
  -> animatic review
  -> optional basic/AI motion
  -> bounded scene/chapter render
  -> FinalArtifact validation
  -> export + notification
```

## Current production gaps

Public-production readiness still requires:

1. Location and Scene continuity materialization.
2. Explicit approved-storyboard reset/versioning.
3. Full pricing/actual-provider-usage accounting, unused reservation release and billing-ledger reconciliation.
4. Broader automated moderation, consent and abuse-policy coverage.
5. Image/TTS/render/export pipeline and FinalArtifact validation.
6. Real-provider failure/restart/reconciliation E2E coverage.
7. Production observability, backup/restore and deletion lifecycle evidence.
