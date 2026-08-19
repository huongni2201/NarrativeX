# ADR-0010: Durable provider operations and admission before Chapter analysis

## Status

Accepted — 2026-08-19

## Decision

Chapter analysis crosses the external-provider boundary only after PostgreSQL commits the complete admission boundary. The worker creates a `provider_operations` row with a stable `(provider_key, request_fingerprint)` unique key and status `RESERVED`, then persists `SUBMITTED` immediately before invoking the external provider. Provider outcomes are `RESERVED`, `SUBMITTED`, `RUNNING`, `COMPLETED`, `FAILED` or `UNKNOWN`.

A provider operation may become `COMPLETED` only when its validated, provider-neutral Chapter analysis result is durably stored in `provider_operations.normalized_result_json`. Persisting `normalized_result_json`, the provider response/operation identifier, `completed_at`, and `status = COMPLETED` is one PostgreSQL transaction. Domain materialization happens only after that transaction commits.

If the worker crashes after provider success but before Character, Location, Scene, or VisualBeat materialization commits, restart recovery reads the normalized result from PostgreSQL and replays materialization without invoking or reconciling the provider again. Chapter materialization remains a single PostgreSQL transaction, so a crash during materialization rolls back partial domain writes before replay.

An exception or timeout after the external boundary is ambiguous: the worker records `UNKNOWN`, keeps the durable job recoverable, and reconciliation calls the provider status/reconcile port before any further action. It never blindly resubmits an operation with an existing fingerprint. For synchronous Vertex `generateContent`, a crash after provider execution but before the normalized result transaction commits remains inherently ambiguous because there is no provider operation lookup capable of reconstructing the lost response. That state must not trigger automatic resubmission.

The enqueue admission pipeline is ownership and idempotency, persisted safety decision, cost estimation, server-side entitlement, atomic PostgreSQL quota reservation, then `OperationPlan`, `GenerationJob`, `StageAttempt` and outbox intent. The MVP estimator derives a bounded range from source length and stores a non-zero authorization cap. Plan entitlements include a monthly credit limit.

Quota admission uses a durable `quota_reservations` lifecycle instead of treating `usage_windows.expensive_jobs_active` as authoritative state. A successful admission creates one `RESERVED` row and binds it to the `GenerationJob` before the enqueue transaction commits. Concurrent expensive-job usage is the number of `RESERVED` rows for the user, independent of calendar-month rollover. Monthly available credit is `monthly_credits - credits_used - current-period RESERVED estimated_cost`.

`GenerationJob` terminalization owns quota finalization. A PostgreSQL trigger runs in the same transaction as the authoritative job status transition: `COMPLETED` changes the linked reservation from `RESERVED` to `CONSUMED` and moves its authorized cost into `usage_windows.credits_used`; `FAILED` or `CANCELED` changes it to `RELEASED` without charging credits. `UNKNOWN`, `STALLED`, `PAUSED_COST_LIMIT`, `QUEUED`, and `RUNNING` keep the reservation `RESERVED` because the expensive operation is still unresolved or recoverable.

Quota finalization is idempotent because every terminal mutation is conditional on `quota_reservations.status = RESERVED`. Replaying the same terminal transition cannot consume credits twice or release capacity twice. The database trigger also covers future backend cancellation paths and other runtimes that update `generation_jobs`, so correctness does not depend on each worker remembering a separate release call.

`OperationPlan.generation_job_id` links the plan to the job after the job identity is created. The nullable link is intentional because the operation plan is inserted first inside the same transaction; it is populated before the transaction commits.

## Invariants

- `ProviderOperation.status = COMPLETED` implies `normalized_result_json IS NOT NULL` for all new or updated rows.
- A durable `COMPLETED` provider operation is replayed from PostgreSQL and never resubmitted to the provider.
- Domain materialization never runs from an in-memory-only provider result.
- `GenerationJob = COMPLETED` means the durable provider result has been materialized successfully.
- Ambiguous synchronous provider outcomes are never converted into blind automatic retries.
- Every newly admitted expensive Chapter-analysis job has exactly one durable quota reservation bound to its `GenerationJob` before commit.
- `QuotaReservation.status = RESERVED` is the source of truth for occupied expensive-job capacity.
- `GenerationJob = COMPLETED` eventually and transactionally implies its linked quota reservation is `CONSUMED`.
- `GenerationJob IN (FAILED, CANCELED)` transactionally implies a still-reserved quota reservation becomes `RELEASED`.
- A quota reservation can leave `RESERVED` at most once; terminal retries cannot double-charge or double-release.

## Consequences

- A worker crash after durable provider completion but before materialization is recoverable without another paid provider call.
- Duplicate provider billing is prevented after the result durability boundary by fingerprint lookup and durable result replay.
- A narrow unavoidable ambiguity remains between synchronous provider execution and PostgreSQL result persistence; this fails safe rather than automatically charging again.
- Existing historical `COMPLETED` provider rows are tolerated by a `NOT VALID` database constraint because they predate durable result storage; all new or updated completed rows must satisfy the invariant.
- Completed and failed jobs no longer leak concurrent expensive-job slots.
- Failed or canceled work no longer leaves estimated authorization permanently charged; completed work converts the reservation into consumed credit exactly once.
- Active expensive-job capacity remains correct across monthly period boundaries because it is derived from durable reservation state rather than a monthly counter.
- Provider-specific actual-cost reconciliation remains follow-up work; the current `CONSUMED` amount is the authorized estimate stored at admission.
- Real provider public enablement still requires real-provider E2E verification and an operational procedure for unresolved `UNKNOWN` operations.
