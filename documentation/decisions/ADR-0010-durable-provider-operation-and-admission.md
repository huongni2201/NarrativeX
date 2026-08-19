# ADR-0010: Durable provider operations and admission before Chapter analysis

## Status

Accepted — 2026-08-19

## Decision

Chapter analysis crosses the external-provider boundary only after PostgreSQL commits the complete admission boundary. The worker creates a `provider_operations` row with a stable `(provider_key, request_fingerprint)` unique key and status `RESERVED`, then persists `SUBMITTED` with the provider operation identifier after submission. Provider outcomes are `RESERVED`, `SUBMITTED`, `RUNNING`, `COMPLETED`, `FAILED` or `UNKNOWN`.

An exception or timeout after the external call is always ambiguous: the worker records `UNKNOWN`, keeps the durable job recoverable, and reconciliation calls the provider status/reconcile port before any further action. It never blindly resubmits an operation with an existing fingerprint. Vertex remains disabled by default until its status/reconciliation endpoint can resolve ambiguous submissions.

The enqueue admission pipeline is ownership and idempotency, persisted safety decision, cost estimation, server-side entitlement, atomic PostgreSQL quota reservation, then `OperationPlan`, `GenerationJob`, `StageAttempt` and outbox intent. The MVP estimator derives a bounded range from source length and stores a non-zero authorization cap. Plan entitlements now include a monthly credit limit so `credits_used + max_authorized_cost` can be enforced server-side.

`OperationPlan.generation_job_id` links the plan to the job after the job identity is created. The nullable link is intentional because the operation plan is inserted first inside the same transaction; it is populated before the transaction commits.

## Consequences

- A worker crash after reservation or submission is observable and recoverable from PostgreSQL.
- Duplicate provider billing is prevented by durable fingerprint lookup and no blind retry.
- Quota/cost decisions are no longer placeholders, but reservation consumption/release and provider-specific billing reconciliation remain follow-up work.
- Real provider public enablement still requires a provider reconciliation implementation and real-provider E2E verification.
