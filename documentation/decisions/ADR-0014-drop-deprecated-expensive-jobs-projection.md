# ADR-0014: Drop the deprecated expensive-jobs projection

- Status: Accepted
- Date: 2026-08-21
- Scope: PostgreSQL quota schema

## Context

`usage_windows.expensive_jobs_active` was retained in the V1 schema as a
deprecated projection. The runtime quota path derives active expensive jobs by
counting `quota_reservations` rows whose status is `RESERVED`; no runtime path
reads or writes the `usage_windows` column.

## Decision

Apply the removal through the forward-only
`V3__drop_deprecated_expensive_jobs_active.sql` migration. Do not rewrite V1,
because V1 may already be applied to a shared or released database. The V2
development seed remains historical and runs before V3 on a fresh database.

The migration integration test is the CI schema gate and asserts that the
column is absent after all migrations. Quota lifecycle integration tests
continue to exercise the authoritative `quota_reservations` path.

The `expensiveJobsActive` API value remains supported: it is a derived runtime
count, not a persistence column.

## Consequences

- Fresh databases apply V1, V2, then V3 successfully.
- Existing V1/V2 databases remove only the obsolete projection when upgraded.
- Consumers must use `quota_reservations` for active expensive-job capacity;
  the removed column cannot be used as a write-side counter.

## Verification

- Search application SQL and persistence code for direct
  `usage_windows.expensive_jobs_active` access before release.
- Run the PostgreSQL migration integration test and quota reservation lifecycle
  integration tests against PostgreSQL.
