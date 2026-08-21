# ADR-0015: Generation durable persistence migration

- Status: Accepted
- Date: 2026-08-21
- Scope: Generation execution persistence boundaries and their PostgreSQL verification.

## Context

Generation execution still had active JPA and direct JDBC adapters after the project adopted
the SQL-first MyBatis architecture. That made the durable enqueue path, stage-attempt state,
operation-plan CAS updates, job-history reads, safety gating, and media-plan revisions harder
to audit consistently.

## Decision

Migrate the active generation persistence boundaries to dedicated MyBatis row models and
explicit XML mappers while keeping application ports unchanged:

- StageAttempt, OperationPlan, GenerationOutbox, JobHistory, ChapterAnalysisSafetyGate, and
  MediaPlan use MyBatis adapters.
- OperationPlan updates use an explicit `row_version` compare-and-set and translate zero
  affected rows into not-found or optimistic-lock conflicts.
- GenerationOutbox enqueue remains idempotent on `event_key`; the durable insert is separate
  from the dispatcher lease query.
- PostgreSQL Testcontainers verifies bean selection, persistence, CAS conflict behavior, and
  duplicate outbox enqueue behavior.
- Architecture tests reject JPA/JdbcTemplate imports in these durable generation adapters.

## Consequences

SQL and transaction behavior are reviewable alongside the schema, and the migration cannot
silently regress through a new JPA/JDBC adapter in the covered generation boundaries. The
application still contains JPA for boundaries outside this migration, and the dispatcher may
continue using JDBC for its operational lease query until that concern is migrated separately.
