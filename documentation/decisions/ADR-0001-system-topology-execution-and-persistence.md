# ADR-0001: System topology, modular monolith, durable execution and persistence architecture

- Status: Accepted
- Date: 2026-08-18 (consolidated and updated: 2026-08-22)
- Scope: Application topology, worker boundary, DDD package boundaries, SQL-first MyBatis persistence, Flyway PostgreSQL baseline, and durable provider execution lifecycle.
- Consolidated from: former ADR-0001, ADR-0003, ADR-0006, ADR-0008, and ADR-0010.

## Context

NarrativeX is an image-first, long-form story-to-video platform combining transaction-heavy business state (projects, chapters, characters, storyboards, quota) with asynchronous Python AI/media workloads (image generation, narration, video rendering). 

Originally, persistence used Spring Data JPA and Hibernate, which obscured SQL execution, made optimistic locking and CAS predicates implicit, and created runtime impedance mismatches with the Python AI worker's PostgreSQL commands. Furthermore, because external AI providers and media rendering can time out or crash mid-flight, memory state or transient queue messages cannot serve as the authoritative truth of execution.

To ensure strict billing accuracy, eliminate duplicate charges, provide deterministic crash recovery, and establish clear, auditable SQL behavior, NarrativeX uses a SQL-first modular monolith architecture backed authoritatively by PostgreSQL.

---

## Decision

### 1. System Topology & Service Boundaries

- **Modular Monolith:** The backend is built as a single Spring Boot modular monolith acting as the application and authorization authority.
- **Python AI/Media Worker:** Technical AI and media execution (TTS, image batch processing, Wan video, FFmpeg rendering) runs in a dedicated Python 3.12 worker process.
- **Authority Model:**
  - **PostgreSQL is authoritative** for business state, ownership, generation jobs, stage attempts, provider operations, billing/quota, notifications, and audit records.
  - **Redis is non-authoritative infrastructure** used solely for session persistence, queue/delivery hints, transient rate limiting, and progress caching. All required work and business state must remain fully reconstructable after Redis data loss.
  - **Object Storage (R2 / Google Drive)** owns binary media bytes; PostgreSQL stores metadata, storage keys, checksums, dimensions, duration, and lifecycle state.
- **Fail-Closed Enqueue Invariant:** Enqueuing an expensive job requires atomic persistence of an `OperationPlan`, `GenerationJob`, `StageAttempt`, and `OutboxEvent` in one PostgreSQL transaction before dispatch. Returning `202 Accepted` is permitted only when a durable execution path exists.

### 2. DDD Feature Package Structure & Transport Envelopes

- **Package Structure:** Feature code is structured vertically under `com.narrativex.backend.feature.<name>` into `api`, `application`, `domain`, and `infrastructure` slices:
  - **Domain layer:** Framework-free domain entities, value objects, and business invariants.
  - **Application layer:** Use cases, application services, and ports (`application.port.in`, `application.port.out`).
  - **Infrastructure layer:** MyBatis mappers, persistence row models, repository adapters, and external client adapters.
  - `feature/common` is a small, generic shared kernel, never a business god module.
- **Transport Contracts:**
  - Standard JSON success responses use `ApiResponse<T>`.
  - Collections use opaque cursor pagination (`limit`, `updated_at DESC, id DESC`) rather than offset paging. `Page`/`Pageable` never cross application port boundaries.
  - Failures return a structured `ErrorResponse` with stable error codes, status, path, timestamp, and correlation ID.
- **Aggregate Boundaries:** Project, Character, ProjectCharacter, GenerationJob / OperationPlan, Storyboard (Chapter and Scene), and MediaPlan.

### 3. SQL-First MyBatis Persistence Architecture

- **Technology-Neutral Domain:** Domain and application code depend only on repository interfaces (e.g. `ChapterRepository`, `ProjectRepository`, `ProviderOperationRepository`). They never import JPA, Hibernate, or MyBatis classes.
- **Explicit Row Models & XML Mappers:** Each feature defines dedicated row models (e.g., `ChapterRow`, `ProjectRow`, `ProviderOperationRow`) and explicit XML mappers (`*Mapper.xml`). Global `map-underscore-to-camel-case` is disabled; column mappings are declared explicitly.
- **Optimistic Concurrency (CAS):** Mutable state updates explicitly test `WHERE id = #{id} AND row_version = #{expectedRowVersion}` and verify `affectedRows == 1`. Zero affected rows immediately trigger a domain `OptimisticConcurrencyException`.
- **Shared Connection Pool:** MyBatis participates in Spring's `DataSourceTransactionManager` sharing the application HikariCP `DataSource`.

### 4. Production-Safe Flyway PostgreSQL Baseline

- **Consolidated Baseline:** Production database migrations are consolidated into a single baseline: `V1__initial_schema.sql` under `app/backend-service/src/main/resources/db/migration/`.
- **Strict Migration Contract:** `spring.flyway.baseline-on-migrate=false`. Flyway must fail fast on an uninitialized non-empty database rather than silently bypassing checksum verification.
- **Baseline Marker:** `schema_baseline` table records the initialization timestamp and baseline version.
- **Canonical Execution SQL Constraints:** All statuses, job types, resource classes, and review states are enforced strictly in PostgreSQL via `CHECK` constraints.

### 5. Durable Provider Execution & Quota Reservation Lifecycle

- **Pre-Submit Fencing (`UNKNOWN`):** Before calling an external paid provider, the worker transitions the `provider_operations` row to `UNKNOWN` with `next_reconcile_at` set. The external call occurs only after the transaction commits.
- **State Machine:**
  - `RESERVED -> UNKNOWN`
  - `UNKNOWN -> SUBMITTED | RUNNING | COMPLETED | FAILED`
  - `SUBMITTED -> RUNNING | UNKNOWN | COMPLETED | FAILED`
  - `RUNNING -> UNKNOWN | COMPLETED | FAILED`
  - `COMPLETED` and `FAILED` are strictly terminal.
- **Result Immutability:** On provider completion, the worker atomically writes `status = COMPLETED`, `completed_at`, `normalized_result_json`, and `result_fingerprint` (SHA-256 hex digest of the normalized result). The first completion is authoritative and cannot be overwritten.
- **Quota Reservation Lifecycle:**
  - Admission inserts a `quota_reservations` row with `RESERVED` status and `estimated_cost`. Active `RESERVED` rows represent active concurrent expensive job capacity.
  - A PostgreSQL trigger (`trg_generation_jobs_finalize_quota`) automatically settles the reservation on job completion (`COMPLETED` settles actual cost; `FAILED`/`CANCELED` settles incurred cost or releases zero-cost reservations). Local FFmpeg rendering and VieNeu zero-cost TTS settle without external billing fences.

---

## Invariants

1. All durable business state transitions and aggregate mutations occur in PostgreSQL transactions.
2. Domain aggregates never import persistence framework packages.
3. Every external paid AI invocation must have a pre-submitted `provider_operations` record in `UNKNOWN` state before network submission.
4. Ambiguous provider outcomes (`UNKNOWN`) trigger scheduled reconciliation with exponential backoff, never blind re-submissions.
5. First completed provider result wins; completed provider operations and render manifests are immutable.
6. A generation job cannot complete without reconciled provider billing unless explicitly categorized as zero-cost local compute.

---

## Consequences

- Financial and billing integrity is guaranteed even during worker crashes, network timeouts, or power failures.
- SQL queries, indexing, and lock behaviors are directly visible, auditable, and tunable in XML mappers.
- High-concurrency operations scale safely via explicit row-version CAS and `FOR UPDATE SKIP LOCKED` worker claims.
- The system maintains strict modular boundaries that can be split into microservices in the future if a measured bottleneck requires it.
