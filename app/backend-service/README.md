# NarrativeX Backend Service

## Purpose

The Spring Boot backend is NarrativeX's product/domain and durable execution-policy authority. Heavy AI/media execution is asynchronous in the Python worker.

Project creation is metadata-only. Chapter save persists source only. Analysis/narration/media generation are explicit operations.

## Technology stack

- Java 25 / Spring Boot 4.1
- PostgreSQL + Flyway
- **MyBatis + explicit SQL is the production persistence boundary**
- MyBatis/explicit-SQL paths cover domain CRUD/query persistence, provider operations, generation jobs/stages/plans, media planning and items, outbox/job history, chapter idempotency, render-input snapshots, chapter media heads, assets, narration, catalogs, local devices and final artifacts
- MyBatis + explicit SQL is the sole production domain persistence path; JPA and `JdbcTemplate` are absent from production domain code
- Local-first single-user boundary (ADR-0030)
- Dispatch to isolated GPU worker via HTTP Compute Protocol v1 (ADR-0031 / COMPUTE_PROTOCOL.md)
- Local media storage adapter backed by project workspace (ADR-0030 / LocalObjectStorageAdapter)
- Testcontainers/JUnit/JaCoCo

## Durable authority

PostgreSQL owns authoritative business state, durable jobs, admission, operation plans, and project metadata. The backend coordinates GPU workloads through HTTP Compute Protocol v1 without allowing external worker access to PostgreSQL. Generated media bytes are managed locally in the project media directory.

## MediaPlan authority

The backend creates/version-controls the authorized MediaPlan and resolves MotionStrategy under the selected ProductionMode. Workers execute the pinned plan and do not independently upgrade deterministic scenes to I2V.

## Narration strategies

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

Current foundations include full-chapter TTS/alignment and user-provided-audio planning/timeline logic. User audio may contain one or multiple ordered parts spanning multiple Chapters. `USER_PROVIDED_AUDIO` plans omit the TTS stage.

Production upload/finalize/alignment integration remains a hardening target.

## Character read model

Project Character list/detail reads are exposed through project-scoped APIs and MyBatis read projections. The frontend uses these authoritative responses for role, importance, aliases/groups, pinned version, appearance state and scene usage instead of runtime demo values. Fields without an authoritative read model remain explicitly unavailable rather than fabricated.

## Persistence migration

Follow `documentation/codebase/PERSISTENCE_MIGRATION.md` and ADR-0001 conventions: explicit row models/result maps/SQL, CAS predicates, affected-row validation and PostgreSQL integration tests. New persistence-heavy features must preserve the MyBatis boundary.

Persistence migration is complete. New work must preserve technology-neutral ports, explicit MyBatis mappings and PostgreSQL integration evidence.

## Development / verification

```bash
./mvnw clean verify
```

The backend does not execute heavy AI/media/FFmpeg workloads inside HTTP request threads.

Coverage policy, the measured baseline, critical-path expectations, and CI artifact locations are documented in `documentation/codebase/BACKEND_COVERAGE.md`.
