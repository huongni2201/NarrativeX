# Story-to-Video Workflow

This is the long-form image-first workflow. Duration, chapter size and visual count are adaptive; the system does not assume 60 minutes, 2,000 words or a fixed images-per-video formula.

## Project and Chapter entry flow

Creating a Project only persists project metadata and defaults. It does not analyze text and does not enqueue AI/media work.

```text
Authenticated owner
  -> Create Project metadata
  -> Add/Edit Chapter source
  -> persist Chapter source/snapshot
  -> explicit Analyze Chapter
  -> durable Chapter pipeline
```

A later Chapter is analyzed incrementally with reusable Project/Character/Location/Style context; unrelated completed Chapters are not reprocessed by default.

## Current MVP analysis path

The canonical analysis request is Chapter-scoped and implemented:

```http
POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs
```

The backend returns `202 Accepted` after validating ownership and the persisted Chapter snapshot and durably enqueueing the job. Creating a Project or saving a Chapter never implicitly triggers this endpoint.

For the current MVP vertical slice:

```text
saved Chapter sourceText/sourceHash/rowVersion
  -> POST analysis-jobs
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> COMMIT
  -> best-effort Redis delivery hint
  -> PostgreSQL worker claim/lease/heartbeat
  -> configured LLM provider
  -> structured Chapter analysis
  -> Character / ProjectCharacter / CharacterVersion
  -> Scene / VisualBeat
  -> COMPLETED
```

PostgreSQL is authoritative. Redis is a non-authoritative wake-up/delivery hint; workers can discover queued work by polling even when Redis is unavailable.

## Worker throughput and materialization

A worker process supports configurable bounded concurrency with `WORKER_CONCURRENCY` (default `4`, allowed range `1..32`). Multiple Chapter analysis jobs may therefore be in flight in one process while PostgreSQL `FOR UPDATE ... SKIP LOCKED`, per-job StageAttempt leases and heartbeats prevent duplicate ownership.

The worker sizes its asyncpg pool from configured concurrency and batches materialization where practical: existing Character lookup/update, Scene insertion and VisualBeat insertion avoid the previous row-by-row round-trip pattern.

Graceful shutdown stops claiming new work and waits for current in-flight tasks to finish before closing the database pool.

## Re-analysis safety

Before replacing generated storyboard rows, the worker verifies that the persisted Chapter snapshot still matches the job's `chapterId + storyVersionId + rowVersion + sourceHash`.

Re-analysis also refuses destructive replacement when an existing Scene or VisualBeat is already approved. An explicit reset/versioning workflow is required before approved storyboard output can be replaced. This prevents a later analysis run from silently deleting approved work.

## Chapter Workspace read path

The Chapter Workspace application use case depends on an outbound `ChapterWorkspaceReadRepository` port rather than `JdbcTemplate`. PostgreSQL-specific SQL and mapping live in the infrastructure adapter.

The workspace projection uses one aggregate CTE query for project name, scene count, visual-beat count, estimated duration and latest Chapter analysis, plus one bounded query for preview scenes. This replaces the previous chatty multi-query application-layer implementation.

The workspace reports `sourceOutdated=true` when the latest analysis source hash differs from the current Chapter source hash. Planning is `COMPLETED` only when the latest analysis is completed for the current source and storyboard rows exist.

## Durable outbox behavior

The enqueue transaction persists durable job state and outbox intent before any Redis hint.

The dispatcher reserves up to 50 eligible PENDING outbox rows inside a short PostgreSQL transaction using `FOR UPDATE SKIP LOCKED`, moves `available_at` forward for a short reservation lease, and commits before calling Redis. Redis network latency therefore does not hold PostgreSQL row locks or an open dispatcher transaction.

After publish succeeds the row is marked `PUBLISHED`. On Redis failure it is rescheduled for retry. If a dispatcher process dies after reservation, the still-PENDING row becomes eligible again after the reservation lease. Duplicate Redis hints are acceptable because PostgreSQL job state is authoritative.

## End-to-end target stages

The broader product target extends the implemented Chapter-analysis slice:

```text
Google OIDC/session + ownership
  -> persisted/current Chapter source snapshot
  -> account/API abuse gate
  -> input moderation + applicable real-person consent
  -> prompt-injection defense
  -> CHAPTER_ANALYZE
  -> detected character identities / Locations / Scenes for affected Chapter scope
  -> Character identity matching / deduplication
  -> Character Bible + CharacterVersion review/lock
  -> CharacterAppearance planning
  -> VISUAL_BEAT_PLAN
  -> OperationPlan + reuse/delta + cost confirmation/reservation
  -> required ReferenceAssets only
  -> image generation + Identity QA + visual review
  -> TTS narration + subtitle timing
  -> browser animatic review
  -> selected basic motion or VIDEO_MOTION_GENERATE
  -> bounded parallel scene/chapter render
  -> FinalArtifact validation
  -> long-form export + notification
```

Ordinary story/chapter analysis does **not** require a blanket per-story copyright/rights-attestation checkbox. Input moderation, real-person consent where applicable, report/review/takedown and other policy controls remain separate gates.

## Stage gates

| Gate | Required condition | Failure action |
|---|---|---|
| Chapter Parsed | valid affected Chapter structure and required scene plan | edit Chapter source or analyze again |
| Characters Approved | primary participating characters have active/locked versions | revise Bible/references |
| Storyboard Approved | scenes/beats have order, narration, timing and visual intent | edit/replan affected Chapter |
| Visual Ready | required visual beats have approved assets | regenerate/review affected scope |
| Audio Ready | narration and subtitle timeline exist | regenerate voice/timing |
| Render Ready | required stages are not pending/failed | retry or omit by explicit rule |
| Final Artifact Valid | private object, MIME, dimensions, checksum and manifest validate | remain failed/unknown; never mark complete |

## Durable operation behavior

For Chapter analysis, the durable boundary is:

```text
request
  -> ownership + Project/Chapter consistency
  -> idempotency
  -> persisted/current Chapter source snapshot
  -> StoryVersion validation where required
  -> current implemented policy gates
  -> one DB transaction:
       OperationPlan
       GenerationJob
       StageAttempt(s)
       OutboxEvent
  -> COMMIT
  -> dispatcher reservation transaction
  -> COMMIT
  -> Redis hint outside DB transaction
  -> worker claim/lease/heartbeat
  -> provider execution
  -> transactional result materialization
```

Every claimed stage has persisted lease/heartbeat state. The target architecture still requires durable ProviderOperation persistence/reconciliation before production-grade ambiguous-submit recovery is complete. `UNKNOWN` must reconcile before blind resubmit once that lifecycle is fully wired.

## Planning and rendering details

Gemini analyzes semantic boundaries within the affected Chapter context. Scene guardrails are roughly 8–10 seconds minimum, 18–30 seconds ideal and 40–45 seconds maximum before merge/split; these are planner guardrails, not hard story limits. A long-form prior of approximately 2.5 visuals/minute is only a starting prior. Complexity, narration pace, motion need, reuse and delta determine actual visual budget.

The default future media path uses approved keyframes plus pan/zoom/fade, subtitles, narration and music. Selected beats may use a `MotionAsset` from Veo/Kling, but final composition still uses keyframe/motion assets and FFmpeg. Scene clips render in bounded parallelism with normalized codec/fps/resolution/audio; finalization promotes only validated immutable output.

## Current production gaps

The Chapter-analysis vertical slice is implemented, but public-production readiness still requires the incomplete gates already tracked elsewhere: verified entitlement/quota and cost reservation/reconciliation, complete moderation/safety enforcement, durable ProviderOperation persistence and `UNKNOWN` reconciliation, notification delivery, broader observability/DR, and real-provider E2E verification.
