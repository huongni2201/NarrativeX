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
- Static schema-reference tests validate that MyBatis table references exist in the authoritative V1 table baseline.

### 4. Final Flyway PostgreSQL baseline

The clean database baseline is split by responsibility into exactly three versioned migrations:

```text
V1__create_tables.sql  -> relational schema, constraints, database functions and triggers
V2__init_indexes.sql   -> performance/claim/partial-uniqueness indexes
V3__seed_data.sql      -> deterministic system/catalog bootstrap data
```

The split is structural rather than historical. Patch migrations such as idempotency widening, media-beat reuse, generation notifications/SSE, project render snapshots and Desktop execution routing are folded into the final definitions rather than retained as an incremental chain.

`spring.flyway.baseline-on-migrate=false` remains mandatory. This rewritten baseline is intended for clean database creation; an older incompatible `flyway_schema_history` requires database recreation or a separately reviewed operator migration rather than checksum/history manipulation.

Relational uniqueness needed as a foreign-key target is declared as a V1 `UNIQUE` constraint. V2 owns indexes whose purpose is query access, claiming, partial uniqueness or measured performance.

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
7. V1 must create a relationally valid schema before V2; V2 cannot be required to satisfy a V1 foreign key.
8. V3 contains deterministic system/catalog data only, never project/user content.

## Consequences

- Financial and billing integrity survives worker crashes and ambiguous external-provider responses.
- SQL, indexing and lock behavior remain visible and reviewable.
- High-concurrency work uses explicit row-version and lease fencing.
- Desktop local execution can reduce cloud-render dependency without moving policy or authoritative job state out of the backend.
- The three-file clean baseline is easier to reason about than a patch chain, at the cost of requiring a clean DB/reviewed operator path when replacing incompatible historical Flyway state.

See [`DATABASE_BASELINE.md`](../codebase/DATABASE_BASELINE.md) for the concrete migration matrix and verification gate.
