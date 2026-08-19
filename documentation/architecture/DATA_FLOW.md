# NarrativeX Data Flow and Durability Model

This document describes the canonical flow from user intent to analysis/media output. PostgreSQL state, not Redis messages or object existence alone, determines what the system believes happened.

## Authority matrix

| Concern | Authoritative store | Acceleration / external copy | Rule |
|---|---|---|---|
| Users, ownership, project/story/chapter/scene state | PostgreSQL | Redis cache | Every project-scoped read/write checks owner/role. |
| Jobs and stage attempts | PostgreSQL | Redis delivery/progress hints | Redis loss must be recoverable from persisted state/outbox. |
| Provider operations | PostgreSQL target contract | Provider APIs/storage evidence | Dedicated durable ProviderOperation persistence and `UNKNOWN` reconciliation remain required before production. |
| Cost plans, reservations, usage ledger | PostgreSQL | Cloud billing export for reconciliation | `billed_to_user_id` is mandatory before billable production work; current Chapter-analysis MVP does not yet complete the full cost reservation lifecycle. |
| Asset metadata and manifests | PostgreSQL | MinIO/S3 binary | DB metadata, checksum and storage key must agree. |
| Binary media | MinIO/S3-compatible storage | CDN/signed URL | Buckets are private; only short-lived signed URLs are exposed. |
| Notifications | PostgreSQL notification + outbox rows | Email/web-push providers | Delivery failure does not change canonical job status. |
| Safety, real-person consent, AI audit | PostgreSQL | Provider safety signals | Application policy/version is canonical. Per-story copyright attestation is not an Analyze/Generate prerequisite. |

## Project and Chapter trigger boundary

Creating a Project is metadata-only and is outside the paid AI/media execution pipeline. Saving a Chapter also does not trigger AI. The first analysis trigger is an explicit Analyze action for a persisted Chapter.

```text
Create Project
  -> persist metadata only
  -> no AI job

Create/Edit Chapter
  -> persist sourceText
  -> backend computes sourceHash
  -> rowVersion identifies the saved Chapter state
  -> no AI job

User clicks Analyze
  -> backend reloads the persisted Chapter
  -> durable Chapter analysis flow
```

The analysis authority is the persisted Chapter snapshot. The browser does not submit arbitrary story text as the source of truth for the AI request.

## Implemented Chapter Analysis MVP flow

The current Chapter-analysis vertical slice implements the following durability boundary:

```text
Authenticated user
  -> POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs
  -> ownership + Project/Chapter/StoryVersion consistency
  -> load persisted Chapter
  -> snapshot:
       projectId
       storyVersionId
       chapterId
       chapterRowVersion
       sourceHash
       sourceText
       sourceLanguage
  -> idempotency based on persisted Chapter source identity
  -> one backend transaction:
       OperationPlan
       GenerationJob
       StageAttempt
       OutboxEvent
  -> COMMIT
  -> best-effort Redis delivery hint
  -> Python worker polls PostgreSQL
  -> claim StageAttempt using FOR UPDATE ... SKIP LOCKED
  -> set RUNNING + lease owner + heartbeat
  -> ChapterAnalysisRequest
  -> one configured LLM provider
  -> structured ChapterAnalysisResult validation
  -> verify Chapter rowVersion/sourceHash still match snapshot
  -> one materialization transaction:
       Character
       ProjectCharacter
       CharacterVersion
       Scene
       VisualBeat
       StageAttempt COMPLETED
       GenerationJob COMPLETED
```

Redis is not required for correctness of this flow. If the Redis hint is lost, the worker can still recover durable queued work from PostgreSQL.

## Chapter analysis contract

The worker request is Chapter-scoped rather than story-text-scoped:

```text
ChapterAnalysisRequest
  projectId
  storyVersionId
  chapterId
  chapterRowVersion
  sourceHash
  sourceText
  sourceLanguage
```

There are intentionally no `rights_attested`, `rights_policy_version` or `rights_basis` fields. Copyright report/review/takedown handling and safety policy remain separate product concerns; a blanket per-story rights checkbox is not a Chapter Analyze prerequisite.

The worker prompt treats `sourceText` as untrusted story data. Commands embedded in story text must not become tool/system instructions.

## Structured Chapter analysis result

The MVP provider result is validated before persistence. Conceptually:

```json
{
  "characters": [
    {
      "name": "...",
      "aliases": [],
      "description": "..."
    }
  ],
  "locations": [
    {
      "name": "...",
      "description": "..."
    }
  ],
  "scenes": [
    {
      "title": "...",
      "narration": "...",
      "characters": [],
      "location": "...",
      "visual_beats": [
        {
          "visual_intent": "..."
        }
      ]
    }
  ]
}
```

The current persistence slice materializes Character/ProjectCharacter/CharacterVersion and Scene/VisualBeat. Public Location and Scene-character/linking contracts may evolve separately; the structured provider output must not be confused with every final domain relation already being public and complete.

## Frontend Chapter Analyze flow

```text
ChapterEditor
  -> local edit makes Chapter dirty
  -> Analyze disabled
  -> user saves Chapter
  -> backend returns new rowVersion/sourceHash
  -> Analyze enabled
  -> POST analysis-jobs
  -> poll GET /api/v1/generation-jobs/{jobId}
  -> QUEUED
  -> RUNNING
  -> COMPLETED / FAILED
```

The frontend must never auto-save and analyze an unpersisted local draft as one hidden action. A user-visible saved Chapter is the analysis boundary.

After `COMPLETED`, project-scoped queries may be invalidated. The public Character and Storyboard read APIs are still required before the UI can claim that all materialized analysis results are directly browsable.

## Durable operation lifecycle — production target

The Chapter-analysis MVP satisfies the first durable enqueue/claim boundary, but the complete production pipeline remains broader:

1. The API resolves owner, Project and persisted/current Chapter snapshot.
2. Idempotency prevents duplicate active work for the same request/source identity.
3. Production abuse, moderation, entitlement/quota and real-person consent gates run where applicable.
4. `OperationPlan` records a bounded non-zero estimate and authorization cap; the enqueue path enforces server-side entitlement and atomically reserves the estimated quota before persistence.
5. One transaction persists and links `OperationPlan`, `GenerationJob`, required `StageAttempt` rows and unique outbox intent; the worker commits `ProviderOperation(RESERVED)` before any provider call.
6. Only after commit may Redis or another dispatcher publish a delivery hint.
7. A worker claims a queued stage with a durable lease and heartbeat.
8. Before any ambiguous/billable external submission, a dedicated `ProviderOperation` is persisted in `RESERVED`.
9. Provider state advances through `SUBMITTED` / `RUNNING` / terminal state.
10. A timeout or ambiguous external outcome becomes `UNKNOWN`; reconciliation checks provider/storage evidence before resubmission.
11. Outputs are validated before promotion/materialization.
12. Usage/cost is reconciled and reservations are consumed/released.
13. Required output validation occurs before the parent job is `COMPLETED`.
14. Terminal job and notification/outbox state are committed atomically where applicable.

## Provider operation lifecycle

Canonical provider state is distinct from parent job state:

```text
RESERVED -> SUBMITTED -> RUNNING -> COMPLETED
                         \-> FAILED
SUBMITTED/RUNNING/submit ambiguity -> UNKNOWN -> reconcile -> terminal/known state
```

The worker contract uses `COMPLETED`, not `SUCCEEDED`, as the canonical successful terminal provider state.

The current Vertex Chapter-analysis adapter performs a synchronous `generateContent` call and validates the returned structured result, but dedicated durable `ProviderOperation` persistence and `UNKNOWN` reconciliation are not yet complete. Therefore this part remains a production release gate.

## Stage lease lifecycle

Current Chapter-analysis worker stages support the durable lifecycle:

```text
QUEUED -> RUNNING -> COMPLETED / FAILED
             |
             +-- heartbeat stale / lease reclaim -> another worker may claim
```

Important rules:

- `StageAttempt.worker_id` and `heartbeat_at` are persisted.
- worker claim uses PostgreSQL row locking with `FOR UPDATE ... SKIP LOCKED`;
- worker process memory is not authoritative;
- a worker must still own the running lease before result materialization is committed;
- a stale lease can be reclaimed according to the configured lease timeout.

A future retry policy may explicitly use `STALLED`/new attempt rows rather than overloading one attempt; retry-count and provider-ambiguity policy must remain explicit.

## Snapshot consistency during analysis

Before AI result materialization, the worker verifies that the Chapter still matches the persisted job snapshot:

```text
chapter.id == job.chapterId
chapter.storyVersionId == job.storyVersionId
chapter.rowVersion == job.chapterRowVersion
chapter.sourceHash == job.sourceHash
```

If the Chapter changed while AI was running, the stale result must not overwrite/materialize against the newer Chapter source. The job fails/requires a new Analyze request for the new source snapshot.

For MVP, this is intentionally preferred over creating separate `ChapterVersion`, `ChapterRevision` or `ChapterSnapshot` aggregates. `Chapter.sourceHash + rowVersion` plus the GenerationJob snapshot is sufficient.

## Redis loss and replay

Redis messages are delivery hints. The durable worker path scans PostgreSQL state, so canonical work remains discoverable if Redis is unavailable or a hint is dropped.

The minimum rule is:

```text
PostgreSQL QUEUED/RUNNING/stale-stage state
  -> recoverable worker claim
```

Future generalized dispatch/replay may republish from outbox rows and provider reconciliation state. Redis loss may delay wake-up/progress signals, but must not erase job/source snapshot state.

## Outbox behavior

The Chapter-analysis enqueue transaction writes an outbox event with a unique event key. The dispatcher runs after commit and publishes a best-effort generation hint.

The Chapter source text itself is not copied into the Redis hint. The durable GenerationJob row contains the snapshot; events only need enough identity for delivery/observation.

Production notification outbox behavior remains a separate concern. A terminal job should eventually write notification intent atomically with terminal state, and delivery failure must not rewrite the canonical job result.

## Vertex provider boundary

The worker has one real Chapter-analysis adapter for Vertex Gemini. It uses ADC/workload identity rather than browser/backend-stored provider secrets and requests structured JSON output which is revalidated by Pydantic before persistence.

Safe defaults:

```text
provider_mode=disabled
```

This means local/dev does not accidentally report fake AI success. To execute a real provider smoke/E2E test, valid Vertex configuration and ADC credentials must be supplied explicitly.

Multi-provider routing is intentionally out of the current MVP slice.

## Image/TTS/render boundary

Image generation, TTS and FFmpeg rendering are not part of the Chapter Analysis Vertical Slice. They should be implemented only after the following flow is stable:

```text
Save Chapter
  -> Analyze
  -> QUEUED
  -> RUNNING
  -> Character + Scene + VisualBeat persistence
  -> COMPLETED
```

The next product milestones can then consume those approved/reviewed analysis artifacts rather than coupling media generation to raw Chapter text.

## Edit and incremental regeneration flow

When a Chapter source changes:

```text
sourceText changes
  -> backend recalculates sourceHash
  -> rowVersion advances
  -> previous analysis job remains historical evidence for its old snapshot
  -> user explicitly analyzes the new saved Chapter state
```

Future `AffectedScopeResolver` logic can compare Chapter/source, Scene, Character, style, timing and render dependencies to reuse unchanged approved media. Immutable approved assets and render versions should not be overwritten.

Character edits have two scopes:

1. identity-level change: `Character / CharacterVersion`;
2. project/story usage change: `ProjectCharacter / CharacterAppearance`.

## Deletion flow

Deletion remains a durable production operation: stop new jobs, cancel or reconcile pending stages, quarantine late provider results, revoke signed URL access, expire/delete identity data and derivatives, reconcile storage accounting, and record completion/error. Backup copies follow retention/recovery policy.

## Consistency rules

- Mutable project, chapter, scene, visual-beat, character-draft and short-draft rows use optimistic `row_version`/`If-Match` where their public command contract supports mutation; stale writes return `409`.
- Chapter source is persisted before analysis; Analyze is disabled for a dirty frontend draft.
- GenerationJob snapshots the saved Chapter identity/source used by AI.
- Worker materialization checks Chapter `rowVersion/sourceHash` before commit.
- Locked character versions, approved assets, render versions and final artifacts are immutable snapshots.
- Provider/model/workflow/prompt/schema/safety versions should be stored with attempts for reproducibility as those production contracts land.
- Output moderation and identity QA happen before media is publishable; `REVIEW` is not equivalent to `SAFE`.
- Local/test developer identity is allowed only under explicit `local`/`test` Spring profiles; missing or unknown profiles with OIDC disabled fail startup.

## Current verification gate

The Chapter Analysis Vertical Slice is not complete merely because source code exists. Before the draft PR is treated as done, verify:

```text
Backend CI
Worker CI
Frontend CI
PostgreSQL migration/integration tests
real Vertex structured-output smoke test
worker restart/stale lease recovery
stale Chapter snapshot rejection
end-to-end Chapter -> Analyze -> COMPLETED -> DB result rows
```

Public Character and Storyboard read APIs should also land before the product UI claims the analyzed artifacts are fully consumable.
