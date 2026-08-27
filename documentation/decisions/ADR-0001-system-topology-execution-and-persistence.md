# ADR-0001: System topology, modular monolith, durable execution and persistence architecture

- Status: Accepted; amended 2026-08-28 for Desktop-only final rendering, SSE status delivery, the V1-V8 clean baseline and Gemini Web Desktop execution
- Date: 2026-08-18 (consolidated and updated: 2026-08-28)
- Scope: Application topology, worker boundary, DDD package boundaries, SQL-first MyBatis persistence, Flyway PostgreSQL baseline, durable provider execution lifecycle and local final-render authority.
- Consolidated from: former ADR-0001, ADR-0003, ADR-0006, ADR-0008, and ADR-0010.

## Context

NarrativeX is an image-first, long-form story-to-video platform combining transaction-heavy business state (projects, chapters, characters, storyboards, quota) with asynchronous Python AI/media workloads and native Desktop final rendering.

Persistence originally used Spring Data JPA/Hibernate, which obscured SQL execution and made concurrency/CAS behavior less explicit. External AI providers can time out or crash mid-flight, so memory state or transient queue messages cannot be authoritative execution state.

NarrativeX therefore uses a SQL-first modular-monolith control plane backed authoritatively by PostgreSQL, separate AI/provider workers, and Electron main as the sole final-render executor.

## Decision

### 1. System topology and service boundaries

- The Spring Boot backend is a modular monolith and the application/authorization authority.
- Python workers execute backend-authorized AI/media provider workloads such as analysis, image generation, narration and validation.
- Electron Desktop executes final project rendering and machine-local media operations under backend assignment/lease control.
- PostgreSQL owns business state, generation jobs, stage attempts, provider operations, quota/billing state, notifications, render assignment/lease state and final-artifact metadata.
- PostgreSQL is also the authority for server sessions and one-time Desktop OAuth handoffs. Redis is not required by the MVP runtime.
- Cloudflare R2 may hold generated/provider media bytes while remote durability is needed before Desktop materialization.
- Desktop ProjectStorage owns project-local bytes, render intermediates/cache and final MP4 artifacts.

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

### 4. Clean Flyway baseline plus append-only evolution

NarrativeX uses a responsibility-separated eight-file pre-release baseline:

```text
V1__identity_and_access.sql               -> identity, session, OAuth handoff and device state
V2__project_story_and_planning.sql        -> project, story, chapter and storyboard state
V3__generation_billing_and_media.sql      -> generation, billing, media and analysis preferences
V4__narration_notifications_and_artifacts.sql -> narration, notifications and artifact metadata
V5__catalog_generation_and_render_snapshots.sql -> catalog, generation and render snapshots
V6__database_logic_and_triggers.sql       -> database functions, triggers and lifecycle logic
V7__indexes.sql                            -> indexes and invariants
V8__seed_catalog.sql                       -> deterministic system/catalog bootstrap data
```

That split is structural rather than historical. Earlier patch migrations and the current Desktop guest/beat-selection/local-execution schema structures were folded into their owning V1-V8 baseline migrations before production freeze. Later feature refinements remain append-only.

V1-V8 form the clean pre-release baseline and may still be reorganized before the first production deployment. After that deployment, checksums are frozen and new schema features must begin with a new append-only `V9__*.sql` rather than rewriting V1-V8.

`spring.flyway.baseline-on-migrate=false` remains mandatory. A clean database applies V1 through V8. Existing databases advance through future versioned migrations normally; checksum/history manipulation is not used as a substitute for a reviewed migration.

Within V1-V8, relational uniqueness needed as a foreign-key target is declared in the owning schema migration, while V7 owns the consolidated query/claim/index set and V8 owns deterministic seeds. Future V9+ migrations may include the schema and indexes needed for a feature atomically.

Historical columns/defaults embedded in frozen migrations do not override current runtime behavior when the executor/path they described has been retired.

### 5. Durable provider execution and quota lifecycle

Before calling a paid external provider, durable provider-operation state exists in PostgreSQL. Ambiguous outcomes use `UNKNOWN` and are reconciled before any resubmission that could duplicate provider work or cost.

Provider-operation lifecycle permits the reviewed transitions around `RESERVED`, `UNKNOWN`, `SUBMITTED`, `RUNNING`, `COMPLETED` and `FAILED`; completed and failed operations are terminal. Completion persists normalized result/billing evidence under concurrency fencing.

Quota admission persists a `quota_reservations` row. The PostgreSQL terminal trigger settles reservations from reconciled provider cost, while explicitly categorized local compute such as VieNeu local TTS can settle without external provider billing rows.

### 6. Desktop final project rendering

Project-level production rendering uses backend-authorized immutable input state and device lease fencing. Final execution occurs only in Electron main:

```text
backend-authorized render snapshot
  -> assigned local device
  -> claim + lease heartbeat
  -> resolve checksum-verified ProjectStorage inputs
  -> Electron FFmpeg/ffprobe
  -> subtitle cues from immutable narration snapshot
  -> local artifacts/<jobId>/final.mp4
  -> backend progress/completion
  -> FinalArtifact metadata only
```

The backend and Python workers do not execute final project FFmpeg rendering and do not store or proxy final MP4 bytes.

## Invariants

1. PostgreSQL is authoritative for durable business/execution/artifact metadata.
2. Domain aggregates never import persistence-framework packages.
3. External paid provider submission must have a durable fenced provider operation before network submission.
4. Ambiguous provider outcomes are reconciled instead of blindly resubmitted.
5. First accepted terminal provider result wins under CAS; immutable media/render input snapshots are not rewritten in place.
6. A generation job cannot settle as completed without valid billing evidence unless it is explicitly modeled as local/zero-provider-cost execution.
7. The frozen V1 baseline must create a relationally valid core schema before V2; V2 cannot be required to satisfy a V1 foreign key.
8. V3 contains deterministic system/catalog data only, never project/user content.
9. Once a Flyway migration is shared/applied, subsequent feature schema changes are append-only versioned migrations rather than checksum rewrites.
10. Final project rendering executes in Electron main under backend lease authority.
11. Final MP4 bytes remain local; backend FinalArtifact persistence is metadata-only.
12. Generation SSE and any database wake-up signal are delivery mechanisms only; PostgreSQL job rows remain authoritative and Desktop can recover through GET/watchdog queries.

## Consequences

- Financial and billing integrity survives worker crashes and ambiguous external-provider responses.
- SQL, indexing and lock behavior remain visible and reviewable.
- High-concurrency work uses explicit row-version and lease fencing.
- Final rendering has one executor and one byte-storage boundary instead of duplicate local/server paths.
- The V1-V8 core remains easy to reason about while future V9+ migrations preserve normal Flyway upgrade semantics after production adoption.
- New feature migrations increase the versioned history over time, but avoid destructive database recreation and checksum mismatch during normal development/deployment evolution.

See [`DATABASE_BASELINE.md`](../codebase/DATABASE_BASELINE.md) for the concrete migration matrix and verification gate.
