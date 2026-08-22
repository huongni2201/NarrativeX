# ADR-0001: System topology and durable execution

- Status: Accepted
- Date: 2026-08-18
- Scope: application topology, worker boundary, durable state and external-provider execution
- Consolidated from the former topology and durable-provider decisions.

## Context

NarrativeX combines transaction-heavy project/story/character state with Python AI/media workloads that have different runtime, provider and scaling needs. External providers and media processing are asynchronous and may time out after accepting work, so queue messages or in-memory status cannot be the business authority. Returning `202 QUEUED` is itself a product/runtime claim and therefore must only happen when the queued work has a durable path to execution.

## Decision

- Use a Spring Boot modular monolith as the application and authorization authority, plus a separately deployed Python 3.12 AI/media worker as the technical execution boundary.
- Keep provider SDKs, GPU/model libraries, TTS and FFmpeg behind capability-oriented ports/adapters. Add another service only after a measured bottleneck, independent ownership/deployment need or hard runtime/security boundary is documented.
- PostgreSQL is authoritative for business state, ownership, jobs, stages, provider operations, cost, safety, notifications and audit. Redis may accelerate delivery, cache and progress, but all required work must be reconstructable after Redis loss.
- Object storage owns binary media; PostgreSQL stores keys, checksums, MIME, dimensions, duration, manifests and lifecycle state. Final artifacts become ready only after immutable-object validation.
- Creating a Project is metadata-only and never creates an AI/media job. Story analysis is a Chapter-scoped operation requested only after the Chapter source/snapshot has been persisted.
- A generation-create endpoint must remain feature-gated until the durable enqueue transaction and worker path are implemented. A scaffold that only writes an `OperationPlan` and a `GenerationJob=QUEUED` must not be exposed as a working production capability.
- Durable enqueue must persist, in one business transaction, the operation plan/authorization or cost reservation, generation job, required stage attempts and outbox/delivery intent. Dispatch occurs only after commit.
- Before an external submission, persist `ProviderOperation` in a provider-specific `RESERVED` state together with idempotency/fingerprint evidence, then CAS-fence it to `UNKNOWN` before the call. `UNKNOWN` may reconcile to `SUBMITTED`/`RUNNING` or a terminal state; stale provider responses must lose on `row_version` conflict.
- `ProviderOperation` uses its own lifecycle enum and must not reuse parent `JobStatus`.
- Stage attempts require claim/lease/heartbeat semantics and an explicit stalled/recovery path.
- Expensive work requires authorization, affected-scope planning, estimate/reservation, entitlement and abuse checks, usage attribution and a spending cap before billable execution.
- Story analysis does not require a per-story copyright/rights checkbox or an application-owned pre-moderation review. Real-person consent, abuse controls, entitlement, quota and provider policy enforcement remain independent controls.

## Minimum production enqueue invariant

```text
request
  -> authentication + ownership
  -> idempotency
  -> persisted/current Chapter source snapshot
  -> active/current StoryVersion where required by the source model
  -> abuse + entitlement/quota
  -> entitlement/quota
  -> affected scope + estimate/authorization
  -> DB transaction:
       OperationPlan/CostReservation
       GenerationJob
       StageAttempt(s)
       OutboxEvent
  -> COMMIT
  -> dispatcher
  -> worker claim/lease
  -> ProviderOperation RESERVED before submit
```

Until this path exists and is integration-tested, `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs` returns `FEATURE_NOT_AVAILABLE` and must not create fake queued work.

## Implementation status — 2026-08-18

The backend enforces the fail-closed rule above in `EnqueueStoryAnalysisUseCase`: the analysis-create operation returns `FEATURE_NOT_AVAILABLE` before any `OperationPlan` or `GenerationJob` is persisted. The HTTP scaffold is Chapter-scoped so Project creation cannot be mistaken for an analysis trigger. This closes the unsafe scaffold where rows could remain indefinitely in `QUEUED` while the Python worker had no consumer path.

Chapter analysis no longer waits for an application-owned moderation decision. New and edited Chapter source is admitted after ownership, snapshot, idempotency, entitlement and quota checks. Provider safety policy remains authoritative during provider execution; a provider rejection is recorded at the affected generation item/scene and does not block unrelated scenes.

The durable production path is still intentionally pending. Re-enabling story-analysis enqueue requires all of the following to land together with integration coverage: request idempotency, persisted/current Chapter source validation, StoryVersion validation where required by the source model, safety/abuse checks, entitlement/quota/concurrency checks, non-placeholder cost estimate and authorization/reservation, atomic `GenerationJob + StageAttempt(s) + OutboxEvent` persistence, post-commit dispatch, worker claim/lease/heartbeat/recovery, and `ProviderOperation RESERVED` before any external provider submission.

Invalid user-triggered domain state transitions are represented as `DomainConflictException` subclasses rather than raw `IllegalStateException`, so the existing API exception mapping can return a conflict response instead of falling through to HTTP 500.

Project ownership access uses explicit application boundaries and server-resolved authenticated identity. Client-controlled identity fields must not be accepted as job ownership authority.

Database integrity errors are classified by SQLSTATE at the API boundary. Expected uniqueness conflicts (`23505`) are returned as `409 RESOURCE_CONFLICT`; other integrity violations are treated as unexpected server defects and logged with the original exception before returning `500 INTERNAL_ERROR`.

## Rights and consent policy clarification

NarrativeX does not require a blanket copyright/rights attestation for ordinary story input. The current consolidated Flyway baseline excludes the retired StoryVersion rights columns and the legacy content-rights attestation table; they are not part of the active schema or canonical StoryVersion contract and must not be reintroduced as a mandatory per-story checkbox.

This does not remove safety or consent obligations that are materially different from copyright attestation. Moderation remains independent, and real-person references still require explicit consent, tenant isolation, retention controls and deletion handling.

## Consequences

- Project creation remains independent from AI provider availability and cannot enqueue analysis.
- Story analysis lifecycle is tied to a persisted Chapter scope, not the Project create lifecycle.
- Domain transactions and ownership checks remain local and explicit.
- Worker scaling and GPU/CPU resource classes can evolve independently without moving canonical authority out of PostgreSQL.
- Retries preserve prior evidence and are policy-driven rather than blind.
- Cross-runtime contracts must be versioned, tested and unable to bypass ownership, entitlement, safety or reconciliation rules.
- UI must represent analysis from the durable analysis/job state and must not expose an internal moderation-pending gate.
- Unexpected database integrity failures stay observable as server defects rather than being hidden behind a generic client conflict.
- StoryVersion no longer carries legacy copyright/rights attestation state in API or persistence contracts.

## Consolidation note

This file is the canonical replacement for the former modular-monolith/worker and durable-provider records.
