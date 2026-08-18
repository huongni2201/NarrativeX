# NarrativeX Data Flow and Durability Model

This document describes the canonical flow from user intent to media output. PostgreSQL state, not Redis messages or object existence alone, determines what the system believes happened.

## Authority matrix

| Concern | Authoritative store | Acceleration / external copy | Rule |
|---|---|---|---|
| Users, ownership, project/story/scene state | PostgreSQL | Redis cache | Every project-scoped read/write checks owner/role. |
| Jobs, stages and provider operations | PostgreSQL | Redis delivery/progress | Redis loss must be recoverable from persisted state/outbox. |
| Cost plans, reservations, usage ledger | PostgreSQL | Cloud billing export for reconciliation | `billed_to_user_id` is mandatory; history is append-only. |
| Asset metadata and manifests | PostgreSQL | MinIO/S3 binary | DB metadata, checksum and storage key must agree. |
| Binary media | MinIO/S3-compatible storage | CDN/signed URL | Buckets are private; only short-lived signed URLs are exposed. |
| Notifications | PostgreSQL notification + outbox rows | Email/web-push providers | Delivery failure does not change job status. |
| Safety, real-person consent, AI audit | PostgreSQL | Provider safety signals | Application policy/version is canonical. Per-story copyright attestation is not an Analyze/Generate prerequisite. |

## Request-to-result flow

```text
Authenticated request
  -> ownership/role + account/IP abuse gate
  -> input moderation + real-person consent when applicable
  -> prompt-injection boundary and structured request validation
  -> entitlement/quota + affected-scope resolution
  -> OperationPlan (estimate range, confidence, max spend)
  -> user confirmation and atomic CostReservation
  -> one transaction: GenerationJob + required StageAttempts + outbox/delivery intent
  -> COMMIT
  -> dispatcher publishes delivery hint
  -> worker claim/lease + heartbeat
  -> ProviderOperation RESERVED before external submit
  -> provider/local operation + usage metering
  -> output validation + moderation/identity QA/human gate
  -> approved asset / RenderVersion / FinalArtifact
  -> atomic terminal state + notification outbox
```

The create-job endpoint must remain disabled until this durable path is actually implemented and tested. A controller/use case that only inserts a `QUEUED` job is not a production execution workflow.

## Durable operation lifecycle

1. The API accepts an idempotency key and resolves the current owner, active/current StoryVersion, project version and expected row version. A repeated key returns the existing operation/job rather than creating another one.
2. The request passes account abuse/rate-limit, input safety/moderation, entitlement/quota and any applicable real-person identity consent checks. There is no per-story copyright/rights checkbox prerequisite.
3. The backend calculates `AffectedScope` and asset reuse before estimating. The plan snapshots duration, semantic complexity, quality, provider/model, TTS duration, render profile and expected new work.
4. The user confirms `maxAuthorizedCost`/credits when required. Authorization/reservation is persisted before any billable provider or GPU stage can be claimed.
5. One transaction persists the `OperationPlan`/authorization-reservation, `GenerationJob`, required `StageAttempt` rows and a unique outbox/delivery intent. No Redis publish is required for transaction success.
6. Only after commit may the outbox dispatcher publish a Redis/delivery message.
7. A worker claims a queued stage with a lease and heartbeat. It must pass resource-class, account fairness, provider limiter/circuit and budget guards.
8. Before an external call, the worker persists a `ProviderOperation` in `RESERVED`, including provider namespace and fingerprint/idempotency evidence. A known successful submission moves through `SUBMITTED`/`RUNNING`; a known failure follows retry policy.
9. A timeout or ambiguous network outcome becomes `UNKNOWN`. The worker queries provider status and storage evidence. It does not submit a second operation until reconciliation proves the first did not happen.
10. Outputs land in a unique temporary object or `.partial` file. MIME, dimensions, duration, checksum, codec and manifest are validated before immutable promotion.
11. The worker records `ResourceUsageRecord`, actual internal/provider cost and billable cost, then the backend consumes/releases the reservation and appends `UsageLedger` entries.
12. Required stage completion and a valid `FinalArtifact` are verified before the parent job is `COMPLETED`. A missing/invalid artifact leaves the job failed, paused or reconciling.

## Current implementation gate

Until durable enqueue/dispatch/worker execution exists, the backend configuration defaults:

```yaml
narrativex:
  features:
    story-analysis-enabled: false
```

When disabled:

- `POST /api/v1/projects/{projectId}/analysis-jobs` returns `503 FEATURE_NOT_AVAILABLE`;
- the request must not create `OperationPlan`, `GenerationJob` or other queued-work rows;
- the frontend must not call the endpoint as part of the normal create-project flow;
- no UI may display fake job progress or fake analysis results in API mode.

The feature may be enabled only after the minimum durable execution invariant is satisfied and integration-tested.

## Provider operation lifecycle

Canonical provider state is distinct from parent job state:

```text
RESERVED -> SUBMITTED -> RUNNING -> COMPLETED
                         \-> FAILED
SUBMITTED/RUNNING/submit ambiguity -> UNKNOWN -> reconcile -> terminal/known state
```

`ProviderOperation` must use a dedicated `ProviderOperationStatus`; it must not reuse `JobStatus`. `UNKNOWN` never means “blindly retry”.

## Stage lease lifecycle

A stage attempt must support at least:

```text
QUEUED -> RUNNING -> COMPLETED / FAILED / CANCELED
             |
             +-- lease expired / heartbeat stale -> STALLED -> recovery policy
```

Claim, lease owner, lease expiry/heartbeat and retry attempt number are durable state. Worker process memory is not authoritative.

## Redis loss and replay

Redis messages are hints for delivery. A recovery loop scans PostgreSQL for `QUEUED`, retryable/stalled and reconcilable `UNKNOWN` work, recreates delivery messages, and uses unique job/stage/provider fingerprints to prevent duplicate work. Progress may lag after Redis loss, but canonical state and provider-operation history must remain intact.

## Notification flow

The same transaction that commits a terminal job state writes an `outbox_events` row with a unique `event_key`. The dispatcher claims outbox rows, creates an in-app `Notification`, and optionally enqueues email/web-push according to user preferences. Re-delivery is idempotent. Delivery failure does not rewrite the canonical job result.

## Edit and incremental regeneration flow

An edit creates a new snapshot/version where needed. `AffectedScopeResolver` compares story, scene, character, style, timing and render dependencies. Unchanged approved assets and compatible scene clips are reused; changed visuals may be reframed/basic-motion or regenerated. The new `OperationPlan` prices only the delta. Immutable approved assets and render versions are never overwritten.

```text
Scene/VisualBeat
 -> SceneCharacter
 -> ProjectCharacter
 -> Character
 -> CharacterVersion
 -> CharacterAppearance
 -> OutfitVersion
 -> ReferenceAssets
```

Character edits have two scopes:

1. identity-level change: `Character / CharacterVersion`;
2. project/story usage change: `ProjectCharacter / CharacterAppearance`.

`AffectedScopeResolver` must distinguish both.

## Deletion flow

Deletion is a durable operation: stop new jobs, cancel or reconcile pending stages, quarantine late provider results, revoke signed URL access, expire/delete identity data and derivatives, reconcile storage accounting, and record completion/error. Backup copies follow retention/recovery policy; the API must not promise immediate physical erasure where backup systems cannot provide it.

## Consistency rules

- Mutable project, scene, visual-beat, character-draft and short-draft rows use optimistic `row_version`/`If-Match`; stale writes return `409`.
- Locked character versions, approved assets, render versions and final artifacts are immutable snapshots.
- Provider/model/workflow/prompt/schema/safety versions are stored with attempts for reproducibility.
- Output moderation and identity QA happen before an asset is publishable; `REVIEW` is not equivalent to `SAFE`.
- Local/test developer identity is allowed only under explicit `local`/`test` Spring profiles; missing or unknown profiles with OIDC disabled fail startup.
