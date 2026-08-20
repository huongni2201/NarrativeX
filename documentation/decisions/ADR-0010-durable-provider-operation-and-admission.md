# ADR-0010: Durable provider operations and admission before Chapter analysis

## Status

Accepted — 2026-08-19; amended 2026-08-20 for optimistic provider-operation CAS

## Decision

Chapter analysis crosses the external-provider boundary only after PostgreSQL commits the complete admission boundary. The worker creates a `provider_operations` row with a stable `(provider_key, request_fingerprint)` unique key and status `RESERVED`, then crosses a pre-submit fence by CAS-transitioning it to `UNKNOWN` before invoking the external provider. Provider outcomes are `RESERVED`, `UNKNOWN`, `SUBMITTED`, `RUNNING`, `COMPLETED`, or `FAILED`.

The canonical provider-operation graph is `RESERVED -> UNKNOWN`; `UNKNOWN` may become `SUBMITTED`, `RUNNING`, `COMPLETED`, or `FAILED`; `SUBMITTED` may become `RUNNING`, `UNKNOWN`, `COMPLETED`, or `FAILED`; and `RUNNING` may become `UNKNOWN`, `COMPLETED`, or `FAILED`. `COMPLETED` and `FAILED` are terminal. Every worker mutation carries the loaded operation snapshot and requires both the expected status and `row_version` to match; a stale update is a concurrency conflict, not a provider failure.

A provider operation may become `COMPLETED` only when its validated, provider-neutral Chapter analysis result is durably stored in `provider_operations.normalized_result_json`. Persisting `normalized_result_json`, the provider response/operation identifier, `completed_at`, and `status = COMPLETED` is one PostgreSQL transaction. Domain materialization happens only after that transaction commits.

If the worker crashes after provider success but before Character, Location, Scene, or VisualBeat materialization commits, restart recovery reads the normalized result from PostgreSQL and replays materialization without invoking or reconciling the provider again. Chapter materialization remains a single PostgreSQL transaction, so a crash during materialization rolls back partial domain writes before replay.

An exception or timeout after the external boundary is ambiguous: the worker records `UNKNOWN`, keeps the durable job recoverable, and reconciliation calls the provider status/reconcile port before any further action. It never blindly resubmits an operation with an existing fingerprint. For synchronous Vertex `generateContent`, a crash after provider execution but before the normalized result transaction commits remains inherently ambiguous because there is no provider operation lookup capable of reconstructing the lost response. That state must not trigger automatic resubmission.

The enqueue admission pipeline is ownership and idempotency, persisted safety decision, cost estimation, server-side entitlement, atomic PostgreSQL quota reservation, then `OperationPlan`, `GenerationJob`, `StageAttempt` and outbox intent. The estimator stores a bounded authorization cap. Plan entitlements include a monthly credit limit.

Quota admission uses a durable `quota_reservations` lifecycle instead of treating `usage_windows.expensive_jobs_active` as authoritative state. A successful admission creates one `RESERVED` row and binds it to the `GenerationJob` before the enqueue transaction commits. Concurrent expensive-job usage is the number of `RESERVED` rows for the user, independent of calendar-month rollover. Monthly available credit is `monthly_credits - credits_used - current-period RESERVED estimated_cost`.

The authorization estimate and terminal charge are intentionally different values. `quota_reservations.estimated_cost` is used only to reserve budget before an external call. A terminal provider response persists immutable billing evidence on `provider_operations`: provider-reported usage, a pricing-catalog snapshot, billing currency, and the calculated `actual_cost`. Historical accounting can therefore be reproduced from the pricing snapshot used when the call completed rather than from a later provider price table.

For Vertex Gemini, a terminal operation must have durable billing evidence before the job can become terminal. A successful response without usable billing metadata is treated as `UNKNOWN`; the worker must not silently fall back to the authorization estimate. Likewise, a configured model without an explicit pricing rule fails closed instead of guessing a price.

`GenerationJob` terminalization owns quota finalization. A PostgreSQL trigger runs in the same transaction as the authoritative job status transition. `COMPLETED` consumes the linked reservation using the sum of durable provider `actual_cost`. `FAILED` or `CANCELED` consumes the reservation when a positive provider cost was already incurred, but releases it when there is no provider charge. `UNKNOWN`, `STALLED`, `PAUSED_COST_LIMIT`, `QUEUED`, and `RUNNING` keep the reservation `RESERVED` because the expensive operation is still unresolved or recoverable.

Quota finalization is idempotent because every terminal mutation is conditional on `quota_reservations.status = RESERVED`. Replaying the same terminal transition cannot consume credits twice or release capacity twice. The database trigger also covers future backend cancellation paths and other runtimes that update `generation_jobs`, so correctness does not depend on each worker remembering a separate release call.

`OperationPlan.generation_job_id` links the plan to the job after the job identity is created. The nullable link is intentional because the operation plan is inserted first inside the same transaction; it is populated before the transaction commits.

## Invariants

- `ProviderOperation.status = COMPLETED` implies `normalized_result_json IS NOT NULL` for all new or updated rows.
- `COMPLETED` and `FAILED` provider operations cannot transition or receive metadata writes through the worker repository.
- Every provider-operation mutation uses the caller's expected `row_version`; stale responses are discarded after reloading the latest durable state.
- A durable `COMPLETED` provider operation is replayed from PostgreSQL and never resubmitted to the provider.
- Domain materialization never runs from an in-memory-only provider result.
- `GenerationJob = COMPLETED` means the durable provider result has been materialized successfully.
- Ambiguous synchronous provider outcomes are never converted into blind automatic retries.
- Every newly admitted expensive Chapter-analysis job has exactly one durable quota reservation bound to its `GenerationJob` before commit.
- `QuotaReservation.status = RESERVED` is the source of truth for occupied expensive-job capacity.
- Authorization uses `estimated_cost`; terminal accounting uses durable provider `actual_cost`.
- A terminal Vertex operation cannot settle quota without durable billing evidence.
- A billable failed/canceled operation consumes its positive actual cost; a zero-cost failed/canceled operation releases its reservation.
- A quota reservation can leave `RESERVED` at most once; terminal retries cannot double-charge or double-release.

## Consequences

- A worker crash after durable provider completion but before materialization is recoverable without another paid provider call.
- Duplicate provider billing is prevented after the result durability boundary by fingerprint lookup and durable result replay.
- A narrow unavoidable ambiguity remains between synchronous provider execution and PostgreSQL result persistence; this fails safe rather than automatically charging again.
- Existing historical `COMPLETED` provider rows are tolerated by a `NOT VALID` database constraint because they predate durable result storage; all new or updated completed rows must satisfy the invariant.
- Completed and failed jobs no longer leak concurrent expensive-job slots.
- The usage ledger records reconciled provider cost instead of the authorization estimate for new terminal jobs.
- A provider call that spends money and later fails application-level validation is still accounted for; a provider response known to be non-billable releases the authorization.
- Active expensive-job capacity remains correct across monthly period boundaries because it is derived from durable reservation state rather than a monthly counter.
- Historical reservations created before durable usage capture retain their previous charged estimate as the best available reconciliation value.
- Adding another model or provider requires an explicit usage parser and immutable pricing rule/snapshot before production settlement is enabled.
- Real provider public enablement still requires real-provider E2E verification and an operational procedure for unresolved `UNKNOWN` operations.
