# ADR-0014: SQL-first ProviderOperation persistence

## Status

Accepted — 2026-08-20; completed — 2026-08-21

## Context

`ProviderOperation` is the narrowest persistence boundary with an explicit
state machine, idempotency key, terminal states and concurrent worker updates.
The Python worker already uses PostgreSQL compare-and-set (CAS) statements,
but the backend adapter still persisted this boundary through JPA entity
mutation. That made the concurrency invariant less visible in the backend
implementation and made the two runtime contracts harder to compare.

## Decision

- Keep `ProviderOperationRepository` as the application-facing port. Use cases
  do not import JPA or MyBatis types.
- Make MyBatis the only backend adapter for `provider_operations` after the
  staged parity and PostgreSQL integration evidence in this repository.
- Use the existing application `DataSource` and Spring transaction strategy;
  MyBatis does not create a second connection pool or database.
- Keep SQL in `ProviderOperationMapper.xml` and map rows through a dedicated
  `ProviderOperationRow`, never through the JPA entity.
- Enforce lifecycle changes with PostgreSQL predicates on both the expected
  `row_version` and the allowed previous statuses. A zero-row update is a
  concurrency conflict.
- Persist normalized output and `result_fingerprint` together with the
  terminal `COMPLETED` transition. A repeated fingerprint is idempotent; a
  different fingerprint is an invariant violation. `COMPLETED` and `FAILED`
  remain terminal.
- Reconciliation scans only due provider operations whose owning stage is
  still recoverable (`RUNNING`, `STALLED` or `UNKNOWN`).

## Consequences

### Positive

- CAS and terminal-state invariants are directly reviewable in SQL.
- PostgreSQL Testcontainers tests cover duplicate reservations, result
  idempotency, terminal states and two-transaction races.
- Metrics distinguish successful transitions, expected CAS conflicts,
  idempotent results and conflicting results.
- Rollback remains a configuration switch while the JPA dependency is still
  needed by other aggregates.

### Negative

- ProviderOperation no longer maintains a second persistence implementation;
  rollback requires restoring code from version control and must not be done by
  blind external resubmission.
- ProviderOperation row mapping and SQL must be kept aligned with the Python
  worker's persisted contract.
- PostgreSQL is required for the migrated integration path; H2 is not evidence
  for SQL compatibility.

## Rollout and rollback

1. Run the MyBatis contract and PostgreSQL concurrency suite in CI.
2. Enable the default MyBatis adapter in staging and compare transition
   conflicts, transaction duration and reconciliation behavior.
3. If a rollback is required, restore the prior version of the adapter through
   the normal deployment process; do not blindly resubmit ambiguous provider
   operations.

## Verification

- `ProviderOperationRepositoryIntegrationTest` runs against PostgreSQL 17 in
  Testcontainers.
- `ProviderOperationDefaultPersistenceSelectionTest` verifies that exactly one
  MyBatis adapter is active without a persistence-selection switch.
- Critical provider-operation queries should be checked with
  `EXPLAIN (ANALYZE, BUFFERS)` against representative production-like data
  before rollout.
