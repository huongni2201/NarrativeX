# ADR-0003: Durable compute execution — intent before I/O, UNKNOWN fencing, signed callbacks and reconciliation

- **Status:** Accepted
- **Date:** 2026-10-15 (consolidated)
- **Replaces:** former ADR-0018 (recovery part) and the older submission-checkpoint, event-driven orchestration, generation-commit observability and provider retry-bound decisions (Git history)

## Context

Generation calls are slow, expensive and run on remote machines that can crash or lose connectivity mid-request. Duplicate GPU work and silently lost results are both unacceptable. Blocking polling inside database transactions previously held connections and coupled finalization to remote I/O.

## Decision

### Backend (Spring/PostgreSQL)

1. Admission persists intent (`GenerationJob`, `StageAttempt`, `ProviderOperation`/`OperationPlan`, capacity reservation, outbox event) in one short transaction before any external call.
2. Each `(taskId, attemptId)` gets one durable target assignment, recorded before submission. Submit, reconcile and cancel all use that target and fail closed if it is unavailable. Machine credentials and base URLs are not stored with the assignment.
3. Transport ambiguity maps to `UNKNOWN`. An `UNKNOWN` operation is never blindly resubmitted. It is reconciled first, and a new attempt needs a deliberate user retry with a new idempotency intent.
4. Signed worker events are received idempotently by `event_id` and finalized monotonically by attempt sequence. Terminal states never reopen, duplicates are acknowledged without reprocessing and stale sequences are no-ops.
5. Finalization is local database work only. A scheduled, non-blocking reconciler makes one bounded observation per pass, with backoff, outside any transaction and passes the result through the same finalizer. Reconciliation attempts are bounded; reaching the limit fails the operation. Cancellation never erases an auditable ambiguous operation.
6. Project-scoped SSE carries job updates to Desktop after commit. PostgreSQL remains the source of truth; SSE is a notification channel.

### Worker (generation-service)

7. Before external submission the worker commits `SUBMITTING` to its SQLite journal. `NOT_SUBMITTED` may dispatch, `SUBMITTED` resumes the stored handle and an ambiguous `SUBMITTING`/`UNKNOWN` never resubmits.
8. Every transition or observation is appended to the SQLite compute-event outbox in the same transaction as the attempt update. Outbox delivery sends HMAC-signed callbacks with bounded retry and backoff. A delivery failure never changes worker terminal state.

### Observability

9. Logs and metrics correlate job, project, chapter, attempt and artifact identity. Commit logs run after the transaction succeeds. Health probes are read-only, and startup reports build and schema identity without credentials.

## Invariants

1. Intent is persisted before external I/O, everywhere: compute, agy analysis (ADR-0009) and Desktop render leases (ADR-0005).
2. No remote call runs inside a database transaction.
3. A provider or worker success alone never completes a domain stage. Results are validated, given stable identity and lineage, and materialized first.

## Consequences

- Duplicate compute and lost results are prevented by construction rather than by timing.
- Reconciliation code must exist for every executor that can produce an ambiguous outcome.
- `ComputeObservationReconciler` (blocking polling) is deprecated for removal and must not gain new callers; finishing its removal is tracked in [current status](../current-status.md).

## Related

- [ADR-0002](ADR-0002-system-topology-and-control-plane.md) · [Compute Protocol](../architecture/compute-protocol.md) · [Performance plan](../plans/performance-optimization.md)
