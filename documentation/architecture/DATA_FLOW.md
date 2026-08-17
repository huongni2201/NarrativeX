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
| Safety, rights, consent, AI audit | PostgreSQL | Provider safety signals | Application policy/version is canonical. |

## Request-to-result flow

```text
Authenticated request
  -> ownership/role + account/IP abuse gate
  -> rights/consent + input moderation
  -> prompt-injection boundary and structured request validation
  -> entitlement/quota + affected-scope resolution
  -> OperationPlan (estimate range, confidence, max spend)
  -> user confirmation and atomic CostReservation
  -> GenerationJob + required StageAttempts + outbox/delivery intent
  -> worker lease and stage execution
  -> provider/local operation + usage metering
  -> output validation + moderation/identity QA/human gate
  -> approved asset / RenderVersion / FinalArtifact
  -> atomic terminal state + notification outbox
```

## Durable operation lifecycle

1. The API accepts an idempotency key and resolves the current owner, project version and expected row version. A repeated key returns the existing operation/job rather than creating another one.
2. The backend calculates `AffectedScope` and asset reuse before estimating. The plan snapshots duration, semantic complexity, quality, provider/model, TTS duration, render profile and expected new work.
3. The user confirms `maxAuthorizedCost`/credits. The reservation is persisted before any billable provider or GPU stage can be claimed.
4. A transaction persists `GenerationJob`, required `StageAttempt` rows and a unique outbox/delivery intent. Redis may then receive a delivery message.
5. A worker claims a queued stage with a lease and heartbeat. It must pass resource-class, account fairness, provider limiter/circuit and budget guards.
6. For an external call, the worker persists a `ProviderOperation` in `RESERVED` before submit. A known successful submission moves through `SUBMITTED`/`RUNNING`; a known failure is retryable only under policy.
7. A timeout or ambiguous network outcome becomes `UNKNOWN`/`RECONCILING`. The worker queries provider status and storage evidence. It does not submit a second operation until reconciliation proves the first did not happen.
8. Outputs land in a unique temporary object or `.partial` file. MIME, dimensions, duration, checksum, codec and manifest are validated before immutable promotion.
9. The worker records `ResourceUsageRecord`, actual internal/provider cost and billable cost, then the backend consumes/releases the reservation and appends `UsageLedger` entries.
10. Required stage completion and a valid `FinalArtifact` are verified before the parent job is `COMPLETED`. A missing/invalid artifact leaves the job failed, paused or reconciling.

## Redis loss and replay

Redis messages are hints for delivery. A recovery loop scans PostgreSQL for `QUEUED`, `RETRY_WAIT`, `STALLED` and reconcilable `UNKNOWN` stages, recreates delivery messages, and uses unique job/stage/provider fingerprints to prevent duplicate work. Progress may lag after Redis loss, but canonical state and provider-operation history must remain intact.

## Notification flow

The same transaction that commits a terminal job state writes an `outbox_events` row with a unique `event_key`. The dispatcher claims outbox rows, creates an in-app `Notification`, and optionally enqueues email/web-push according to user preferences. Re-delivery is idempotent. In-app notification should be persisted within 30 seconds of terminal commit; email enqueue target is two minutes and delivery remains retryable/best effort.

## Edit and incremental regeneration flow

An edit creates a new snapshot/version where needed. `AffectedScopeResolver` compares story, scene, character, style, timing and render dependencies. Unchanged approved assets and compatible scene clips are reused; changed visuals may be reframed/basic-motion or regenerated. The new `OperationPlan` prices only the delta. Immutable approved assets and render versions are never overwritten.

## Deletion flow

Deletion is a durable operation: stop new jobs, cancel or reconcile pending stages, quarantine late provider results, revoke signed URL access, expire/delete identity data and derivatives, reconcile storage accounting, and record completion/error. Backup copies follow retention/recovery policy; the API must not promise immediate physical erasure where backup systems cannot provide it.

## Consistency rules

- Mutable project, scene, visual-beat, character-draft and short-draft rows use optimistic `row_version`/`If-Match`; stale writes return `409`.
- Locked character versions, approved assets, render versions and final artifacts are immutable snapshots.
- Provider/model/workflow/prompt/schema/safety versions are stored with attempts for reproducibility.
- Output moderation and identity QA happen before an asset is publishable; `REVIEW` is not equivalent to `SAFE`.
