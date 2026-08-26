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
- Spring Security + Spring Session JDBC + CSRF + Google OIDC authentication
- PostgreSQL-backed one-time Desktop OAuth handoffs; raw handoff codes are never persisted
- Testcontainers/JUnit/JaCoCo

Redis is not required by the MVP backend runtime.

## Durable authority

PostgreSQL owns authoritative domain/job/plan/usage metadata, server sessions and short-lived OAuth handoff state. Python workers claim durable jobs directly from PostgreSQL using their normal polling/lease queries. Generation/media outbox rows are transactional evidence and are finalized after commit without an external broker. Cloudflare R2 owns durable generated-media transport bytes.

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
