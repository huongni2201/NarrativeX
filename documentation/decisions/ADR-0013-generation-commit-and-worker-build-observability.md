# ADR-0018: Generation commit and worker build observability

## Status

Accepted

## Context

Narration generation is durably created in one backend transaction and claimed by a
Python worker through PostgreSQL polling. The existing backend log was emitted before
the transaction commit, while the worker startup log did not identify the database,
schema or deployed build. The Compose file also repeated database wiring and built
services without a stable runtime build identity.

This made a production symptom such as "backend accepted narration but the worker is
idle" difficult to distinguish between a rolled-back transaction, a database/schema
mismatch, a stale image, and a worker claim/provider failure.

## Decision

- Keep PostgreSQL as the authoritative generation queue and state store. Redis remains
  an optional delivery hint and is not required for narration-worker correctness.
- Log narration job preparation inside the transaction and register a separate
  `Committed narration job` log through Spring's `afterCommit` synchronization.
- Before starting worker tasks, verify PostgreSQL with
  `current_database()` and `current_schema()`, then log the resolved database target,
  narration provider, worker roles and `BUILD_SHA`. Credentials are never logged.
- Define shared Compose anchors for PostgreSQL connection values and worker database
  URLs. Build/runtime services carry a `BUILD_SHA` and are tagged with that identity;
  image registry prefixes remain configurable for production deployment.
- Health checks may perform read-only database probes, but must not claim or mutate jobs.

## Consequences

### Positive

- A job can be distinguished as prepared versus committed in backend logs.
- Worker logs reveal whether it is connected to the expected database/schema and which
  immutable build is running.
- Compose configuration has one source of database interpolation and supports
  reproducible image tags.
- The durable polling fallback remains intact if Redis delivery hints fail.

### Negative

- Each worker startup performs one additional read-only PostgreSQL identity query.
- Deployments must provide a meaningful `BUILD_SHA`; `local`/`unknown` are intended for
  development or unspecified builds only.
- A post-commit log is observability only and cannot replace querying PostgreSQL for
  authoritative job state.

## Related Decisions

- ADR-0001: System topology, modular monolith, durable execution and persistence architecture
- ADR-0007: Architecture guards and pipeline observability
