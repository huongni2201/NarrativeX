# ADR-0001: System topology, modular monolith, durable execution and persistence architecture

- Status: Accepted; amended 2026-09-12 for the squashed V1–V8 baseline, non-monetary quota model and R2 voice-only storage boundary
- Date: 2026-08-18 (consolidated and updated: 2026-09-12)
- Scope: Application topology, worker boundary, DDD package boundaries, SQL-first MyBatis persistence, Flyway PostgreSQL baseline, durable provider execution lifecycle and local final-render authority.
- Consolidated from: former ADR-0001, ADR-0003, ADR-0006, ADR-0008, and ADR-0010.

## Context

NarrativeX is an image-first, long-form story-to-video platform combining transaction-heavy business state (projects, chapters, characters, storyboards and non-monetary quota/capacity state) with asynchronous Python AI/media workloads and native Desktop final rendering.

Persistence originally used Spring Data JPA/Hibernate, which obscured SQL execution and made concurrency/CAS behavior less explicit. External AI providers can time out or crash mid-flight, so memory state or transient queue messages cannot be authoritative execution state.

NarrativeX therefore uses a SQL-first modular-monolith control plane backed authoritatively by PostgreSQL, separate AI/provider workers, and Electron main as the sole final-render executor.

## Decision

### 1. System topology and service boundaries

- The Spring Boot backend is a modular monolith and the application/authorization authority.
- Python workers execute backend-authorized AI/media provider workloads such as analysis, image generation, narration and validation.
- Electron Desktop executes final project rendering and machine-local media operations under backend assignment/lease control.
- PostgreSQL owns business state, generation jobs, stage attempts, provider operations, non-monetary quota reservations/usage counters, notifications, render assignment/lease state and final-artifact metadata.
- PostgreSQL is also the authority for server sessions and one-time Desktop OAuth handoffs. Redis is not required by the MVP runtime.
- Cloudflare R2 is restricted to authenticated reusable ACCOUNT voice-reference/custom-voice bytes. It is not generated-project-media transport, fallback storage or final-video storage.
- Desktop ProjectStorage owns project-local generated/imported media, render intermediates/cache and final MP4 artifacts.

Provider-consuming work is admitted only after a durable PostgreSQL execution path exists. Returning `202 Accepted` is valid only after the required authoritative rows have been persisted transactionally.

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
V1__identity_and_access.sql                    -> identity, session, OAuth handoff and device state
V2__project_story_and_planning.sql             -> project, story, chapter, storyboard and media-planning state
V3__generation_quota_and_media.sql             -> generation, provider operations, non-monetary quota and media
V4__narration_notifications_and_artifacts.sql  -> narration, notifications and artifact metadata
V5__catalog_generation_and_render_snapshots.sql -> catalogs, generation lineage, continuity and render snapshots
V6__database_logic_and_triggers.sql            -> database functions, guards, quota settlement and lifecycle logic
V7__indexes.sql                                -> indexes and access-path invariants
V8__seed_catalog.sql                           -> deterministic system/catalog bootstrap data
```

That split is structural rather than historical. The former V9–V18 patch sequence has been folded into the owning V1–V8 baseline migrations. New pre-production databases therefore create the final schema directly instead of creating retired billing/pricing, credit-accounting or storage-compatibility shapes and later removing them.

V1–V8 form the clean pre-release baseline and may still be reorganized before the first production deployment. After that deployment, checksums and filenames are frozen and new schema features begin with append-only `V9__*.sql` migrations.

`spring.flyway.baseline-on-migrate=false` remains mandatory. A clean database applies V1 through V8. Within the baseline, relational uniqueness needed as a foreign-key target is declared in the owning schema migration, V7 owns the consolidated query/claim/index set and V8 owns deterministic seeds.

### 5. Durable provider execution and non-monetary quota lifecycle

Before crossing an external provider submission boundary, durable provider-operation state exists in PostgreSQL. Ambiguous outcomes use `UNKNOWN` and are reconciled before any resubmission that could duplicate provider work.

Provider-operation lifecycle preserves fenced request identity, external operation identity where available, normalized result state, result fingerprints and reconciliation metadata. It does not persist user billing currency, actual provider cost, pricing snapshots or pricing fingerprints as an application contract.

Admission services receive account identity only; project/source/voice validation belongs to the calling use case. Retired zero-cost estimators and unused uploaded-audio admission facades are removed. Capacity exhaustion uses the stable `CAPACITY_LIMIT` API code.

Quota admission is non-monetary. `quota_reservations` represents supported capacity/export reservations such as `CAPACITY` and `LONGFORM_EXPORT`. The terminal PostgreSQL trigger consumes successful reservations and releases failed/canceled reservations; completed long-form exports increment the period usage counter exactly once. There is no credit balance, monthly-credit allowance, estimated-cost reservation or `PAUSED_COST_LIMIT` job state.

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
3. External provider submission must have a durable fenced provider operation before network submission when that provider path requires durable reconciliation.
4. Ambiguous provider outcomes are reconciled instead of blindly resubmitted.
5. First accepted terminal provider result wins under CAS; immutable media/render input snapshots are not rewritten in place.
6. Generation completion depends on valid execution/result state, not monetary billing evidence.
7. The current clean pre-release database is exactly the accepted V1–V8 baseline; obsolete patch migrations are not retained for disposable development compatibility.
8. V8 contains deterministic system/catalog data only, never project/user content.
9. After the first production deployment, applied Flyway migrations become immutable and subsequent schema changes are append-only.
10. Final project rendering executes in Electron main under backend lease authority.
11. Final MP4 bytes remain local; backend FinalArtifact persistence is metadata-only.
12. Generation SSE and any database wake-up signal are delivery mechanisms only; PostgreSQL job rows remain authoritative and Desktop can recover through GET/watchdog queries.
13. R2 is ACCOUNT voice-reference/custom-voice storage only; project media and final renders do not use an R2 fallback path.

## Consequences

- Worker crashes and ambiguous external-provider responses remain recoverable without relying on monetary billing state.
- SQL, indexing and lock behavior remain visible and reviewable.
- High-concurrency work uses explicit row-version, reservation and lease fencing.
- Quota logic is simpler: capacity/export usage is enforced without a parallel credit/pricing ledger.
- Final rendering has one executor and one byte-storage boundary instead of duplicate local/server paths.
- The V1–V8 core remains easy to reason about before production freeze while future V9+ migrations preserve normal Flyway upgrade semantics after production adoption.

See [`DATABASE.md`](../architecture/DATABASE.md) for the concrete migration matrix and verification gate.


### Cleanup clarification — 2026-09-13

`IMAGE_MOTION` is the only executable production mode. `MotionStrategyResolver` maps every current editor motion intent to `BASIC_IMAGE_MOTION`; there is no dormant provider/GPU/cost authorization pipeline behind that mapping. The former motion policy/context/decision wrappers had no reachable image-to-video branch under the current enum and are removed. Adding another executable mode requires an explicit production-policy decision and implementation, not enabling pre-existing fallback code.
