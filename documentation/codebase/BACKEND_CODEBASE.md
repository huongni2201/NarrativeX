# Backend Codebase and Module Plan

## Current implementation

`app/backend-service` is a Spring Boot 4.1.0 application with Java 25, Spring Web, Validation, Data JPA, Security, Redis, Actuator, PostgreSQL and Flyway. The entry point is `NarrativeXBackendApplication`. The repository now contains first module foundations under `modules/project`, `modules/generation`, `modules/storyboard` and `modules/health`, plus shared API/domain primitives. The migrations include the baseline, `V2__domain_foundation.sql` and the v1.7 control-plane migration; the full v1.7 domain remains incremental.

The current `SecurityConfig` is development scaffolding: CSRF is disabled, every route is permitted and sessions are stateless. It is not the v1.7 auth contract. The current generation foundation includes `GenerationJob`, `OperationPlan`, `StageAttempt` and `ProviderOperation` domain types, but the complete worker lease/reconciliation/outbox implementation is still target work.

## Target module responsibilities

```text
auth              Google OIDC, HttpOnly session, roles/current user
project           ownership and project lifecycle
story             StoryVersion, rights attestation, analysis command
character         Bible, versions, outfits, references, consent
scene             Scene, Shot, VisualBeat, storyboard edits
generation        Job/StageAttempt/Lease/ProviderOperation state machines
asset             metadata, checksum, signed URL and lifecycle policy
render            RenderVersion, manifest and FinalArtifact validation
shorts            candidates, vertical plan and ShortClip
provider          capability registry, routing, health and ports
cost/billing      OperationPlan, reservation, usage and reconciliation
entitlement       plan capability, usage windows, watermark/export limits
safety             moderation, prompt boundary, rights/consent gates
notification      outbox, in-app notification and channel delivery
characterlibrary  immutable user template versions and project snapshots
```

## Persistence contract

PostgreSQL owns all canonical state. The target schema includes users/external identities, projects/story/chapter/scene/visual beat, character versions/references, assets, generation jobs/attempts, stage attempts, provider operations, render/final artifacts, shorts, operation plans/reservations/estimates, usage/resource records, entitlements/usage windows, notifications/outbox, rights/moderation/consent, AI audit and deletion requests.

JPA entities must use optimistic locking for mutable rows (`row_version`). Approved/locked/render snapshots are immutable. Flyway migrations must be backward-compatible, rehearsed in staging, and preceded by a production backup snapshot.

## Application flow

Controller -> authenticated user/ownership -> use case -> safety/entitlement/abuse guards -> affected scope and operation plan -> reservation -> job/stage persistence -> Redis delivery hint -> worker -> state transition/event. Long-running work never runs in an HTTP request thread.

Every command that can be retried accepts an idempotency key. Unique constraints cover operation/event/provider fingerprints. A stale `If-Match`/row version returns `409`, and duplicate idempotent requests return the existing result.

## Durable job model

`GenerationJob` is the parent operation. A `StageAttempt` is a persisted, independently retryable stage with lease and heartbeat. A billable provider call has a `ProviderOperation` reserved before submission:

```text
StageAttempt: QUEUED -> RUNNING -> COMPLETED / FAILED / CANCELED
               \-> STALLED -> RETRY_WAIT / RECONCILING
ProviderOperation: RESERVED -> SUBMITTED -> RUNNING
                   -> COMPLETED / FAILED / UNKNOWN
FinalArtifact: PENDING -> VALIDATING -> READY / INVALID
```

`UNKNOWN` is a first-class safety state. The backend schedules reconciliation against provider status and storage evidence; no blind resubmit is allowed. Parent completion requires all required stages and a valid immutable `FinalArtifact`.

## Security and policy responsibilities

The backend, not the client or worker, enforces Google OIDC session ownership, account/IP abuse limits, rights attestation, real-person consent, moderation decisions, prompt-injection boundaries, plan entitlement, quota and max authorized spend. Provider credentials use runtime secret injection/workload identity/ADC and never appear in the browser.

## Notifications and audit

Terminal state changes and notification outbox events are committed transactionally. The dispatcher creates durable in-app notifications and retries optional email/web-push independently. AI audit events capture actor, project/job/stage, provider/model, prompt/schema/policy versions, fingerprints, safety outcome and usage while minimizing raw sensitive content.

## Verification priorities for implementation

1. Replace permissive `SecurityConfig` with Google OIDC/session and ownership tests.
2. Add Flyway domain migrations and module boundaries before feature controllers.
3. Add idempotent operation-plan/reservation/job/stage persistence.
4. Add worker contract, leases, reconciliation and outbox recovery.
5. Add provider adapters and cost/safety/entitlement integration tests.
