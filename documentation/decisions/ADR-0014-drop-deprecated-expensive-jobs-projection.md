# ADR-0014: Drop the deprecated expensive-jobs projection

- Status: Superseded by ADR-0006 for the development baseline
- Date: 2026-08-21
- Scope: PostgreSQL quota schema

## Context

`usage_windows.expensive_jobs_active` was retained in the V1 schema as a
deprecated projection. The runtime quota path derives active expensive jobs by
counting `quota_reservations` rows whose status is `RESERVED`; no runtime path
reads or writes the `usage_windows` column.

## Decision

The removal is present in the consolidated `V1__initial_schema.sql` baseline.
This supersedes the former forward-only `V3__drop_deprecated_expensive_jobs_active.sql`
development path. Databases created from the former split must be recreated or
explicitly re-baselined by an operator; the application does not rewrite
`flyway_schema_history`.

The migration integration test is the CI schema gate and asserts that the
column is absent after all migrations. Quota lifecycle integration tests
continue to exercise the authoritative `quota_reservations` path.

The `expensiveJobsActive` API value remains supported: it is a derived runtime
count, not a persistence column.

## Consequences

- Fresh databases apply V1 and V2 successfully.
- Existing databases from the former split are outside the automatic upgrade
  path and require the operator-reviewed procedure in ADR-0006.
- Consumers must use `quota_reservations` for active expensive-job capacity;
  the removed column cannot be used as a write-side counter.

## Verification

- Search application SQL and persistence code for direct
  `usage_windows.expensive_jobs_active` access before release.
- Run the PostgreSQL migration integration test and quota reservation lifecycle
  integration tests against PostgreSQL.
