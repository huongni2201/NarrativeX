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
- A generation-create endpoint must remain feature-gated until the durable enqueue transaction and worker path are implemented. A scaffold that only writes an `OperationPlan` and a `GenerationJob=QUEUED` must not be exposed as a working production capability.
- Durable enqueue must persist, in one business transaction, the operation plan/authorization or cost reservation, generation job, required stage attempts and outbox/delivery intent. Dispatch occurs only after commit.
- Before an external submission, persist `ProviderOperation` in a provider-specific `RESERVED` state together with idempotency/fingerprint evidence. A known submit progresses through `SUBMITTED`/`RUNNING`; an ambiguous outcome becomes `UNKNOWN` and must reconcile before resubmission.
- `ProviderOperation` uses its own lifecycle enum and must not reuse parent `JobStatus`.
- Stage attempts require claim/lease/heartbeat semantics and an explicit stalled/recovery path.
- Expensive work requires authorization, affected-scope planning, estimate/reservation, entitlement and abuse checks, usage attribution and a spending cap before billable execution.
- Story analysis does not require a per-story copyright/rights checkbox. Input safety/moderation and real-person consent where applicable remain independent gates.

## Minimum production enqueue invariant

```text
request
  -> authentication + ownership
  -> idempotency
  -> active/current StoryVersion
  -> abuse + safety/moderation
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

Until this path exists and is integration-tested, `POST /api/v1/projects/{projectId}/analysis-jobs` returns `FEATURE_NOT_AVAILABLE` and must not create fake queued work.

## Consequences

- Domain transactions and ownership checks remain local and explicit.
- Worker scaling and GPU/CPU resource classes can evolve independently without moving canonical authority out of PostgreSQL.
- Retries preserve prior evidence and are policy-driven rather than blind.
- Cross-runtime contracts must be versioned, tested and unable to bypass ownership, entitlement, safety or reconciliation rules.
- UI must represent analysis as unavailable/pending integration instead of treating a non-executable queued row as successful submission.

## Consolidation note

This file is the canonical replacement for the former modular-monolith/worker and durable-provider records.
