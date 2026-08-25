# ADR-0001: System topology, modular monolith, durable execution and persistence architecture

- Status: Accepted
- Date: 2026-08-18 (consolidated and updated: 2026-08-25)
- Scope: Application topology, worker boundary, DDD package boundaries, SQL-first MyBatis persistence, Flyway PostgreSQL baseline, and durable provider execution lifecycle.
- Consolidated from: former ADR-0001, ADR-0003, ADR-0006, ADR-0008, and ADR-0010.

## Context

NarrativeX is an image-first, long-form story-to-video platform combining transaction-heavy business state (projects, chapters, characters, storyboards, quota) with asynchronous Python AI/media workloads.

Persistence originally used Spring Data JPA/Hibernate, which obscured SQL execution and made concurrency/CAS behavior less explicit. External AI providers and media rendering can also time out or crash mid-flight, so memory state or transient queue messages cannot be authoritative execution state.

NarrativeX therefore uses a SQL-first modular-monolith architecture backed authoritatively by PostgreSQL.

## Decision

### 1. System topology and service boundaries

- The Spring Boot backend is a modular monolith and the application/authorization authority.
- Python workers execute AI/media workloads.
- Electron Desktop may execute explicitly assigned local media/render work, but backend policy and durable job state remain authoritative.
- PostgreSQL owns business state, generation jobs, stage attempts, provider operations, quota/billing state, notifications and audit state.
- Redis is non-authoritative infrastructure for server sessions, Desktop OAuth handoff, delivery/progress hints and other reconstructable transient concerns.
- Object storage owns binary media bytes; PostgreSQL stores durable metadata, storage keys, checksums, dimensions, durations and lifecycle state.

Expensive work is admitted only after a durable PostgreSQL execution path exists. Returning `202 Accepted` is valid only after the required authoritative rows have been persisted transactionally.

### 2. DDD feature package structure and transport contracts

Feature code is organized vertically under `com.narrativex.backend.feature.<name>` into `api`, `application`, `domain` and `infrastructure` slices.

- Domain code remains framework-neutral.
- Application code owns use cases and ports.
- Infrastructure owns MyBatis row models/XML mappers, external clients and persistence adapters.
- `feature/common` is a small shared kernel rather than a business god module.

Public JSON success responses use `ApiResponse<T>`. Mutable contracts use explicit optimistic-concurrency semantics where required. Collections use opaque cursor pagination where appropriate rather than leaking persistence-framework pagination types.

### 3. SQL-first MyBatis persistence

- Domain/application code depends on repository ports, never JPA/Hibernate/MyBatis types.
- SQL is explicit in MyBatis XML mappers with dedicated persistence row models.
- Mutable state transitions use explicit CAS/row-version predicates and treat zero affected rows as conflicts.
- MyBatis participates in Spring-managed transactions over the application datasource.
- Static schema-reference tests and PostgreSQL planning tests validate MyBatis table/column references against the authoritative migrated schema.

### 4. Frozen Flyway core baseline plus append-only evolution

NarrativeX retains the consolidated three-file core baseline:

```text
V1__create_tables.sql  -> core relational schema, constraints, database functions and triggers
V2__init_indexes.sql   -> core performance/claim/partial-uniqueness indexes
V3__seed_data.sql      -> deterministic system/catalog bootstrap data
```

That split is structural rather than historical. Earlier patch migrations such as idempotency widening, media-beat reuse, generation notifications/SSE, project render snapshots and Desktop execution routing were folded into V1-V3 before this baseline was shared.

Once the consolidated V1-V3 baseline is present on `main` and may have been applied by developer or deployment databases, its checksums are frozen. New schema features use append-only versioned migrations (`V4+`) instead of rewriting V1-V3. `V4__desktop_guest_installations.sql` is the first migration under this evolution rule.

`spring.flyway.baseline-on-migrate=false` remains mandatory. A clean database applies the complete canonical migration sequence. Existing databases advance through new versioned migrations normally; checksum/history manipulation is not used as a substitute for a reviewed migration.

Within V1-V3, relational uniqueness needed as a foreign-key target is declared as a V1 `UNIQUE` constraint and V2 owns core query/claim indexes. Additive V4+ migrations are feature-scoped deployable units and may include the table, constraints and indexes needed for that feature atomically.

### 5. Durable provider execution and quota lifecycle

Before calling a paid external provider, durable provider-operation state exists in PostgreSQL. Ambiguous outcomes use `UNKNOWN` and are reconciled before any resubmission that could duplicate provider work or cost.

Provider-operation lifecycle permits the reviewed transitions around `RESERVED`, `UNKNOWN`, `SUBMITTED`, `RUNNING`, `COMPLETED` and `FAILED`; completed and failed operations are terminal. Completion persists normalized result/billing evidence under concurrency fencing.

Quota admission persists a `quota_reservations` row. The PostgreSQL terminal trigger settles reservations from reconciled provider cost, while explicitly categorized local compute such as VieNeu local TTS and CPU chapter/project rendering can settle without provider billing rows.

### 6. Desktop local project rendering

Project-level production rendering uses immutable snapshot tables:

- `project_render_input_snapshots`
- `project_render_input_chapters`
- `project_render_input_beats`

`execution_target` is either `CLOUD` or `LOCAL_DEVICE`. A local target is assigned to one paired device and claimed/heartbeated through durable lease fencing. Signed asset access is derived from immutable snapshot storage keys; completed artifacts return to the canonical `final_artifacts` model.

## Invariants

1. PostgreSQL is authoritative for durable business/execution state.
2. Domain aggregates never import persistence-framework packages.
3. External paid provider submission must have a durable fenced provider operation before network submission.
4. Ambiguous provider outcomes are reconciled instead of blindly resubmitted.
5. First accepted terminal provider result wins under CAS; immutable render/media snapshots are not rewritten in place.
6. A generation job cannot settle as completed without valid billing evidence unless it is explicitly modeled as local/zero-provider-cost execution.
7. The frozen V1 baseline must create a relationally valid core schema before V2; V2 cannot be required to satisfy a V1 foreign key.
8. V3 contains deterministic system/catalog data only, never project/user content.
9. Once a Flyway migration is shared/applied, subsequent feature schema changes are append-only versioned migrations rather than checksum rewrites.

## Consequences

- Financial and billing integrity survives worker crashes and ambiguous external-provider responses.
- SQL, indexing and lock behavior remain visible and reviewable.
- High-concurrency work uses explicit row-version and lease fencing.
- Desktop local execution can reduce cloud-render dependency without moving policy or authoritative job state out of the backend.
- The V1-V3 core remains easy to reason about while V4+ preserves normal Flyway upgrade semantics for databases that already consumed the shared baseline.
- New feature migrations increase the versioned history over time, but avoid destructive database recreation and checksum mismatch during normal development/deployment evolution.

See [`DATABASE_BASELINE.md`](../codebase/DATABASE_BASELINE.md) for the concrete migration matrix and verification gate.
