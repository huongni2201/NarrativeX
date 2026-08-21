# NarrativeX Backend Service

## Purpose

The Spring Boot backend is NarrativeX's product/domain and durable execution-policy authority. Heavy AI/media execution is asynchronous in the Python worker.

Project creation is metadata-only. Chapter save persists source only. Analysis/narration/media generation are explicit operations.

## Technology stack

- Java 25 / Spring Boot 4.1
- PostgreSQL + Flyway
- **MyBatis is the strategic persistence direction**
- MyBatis/explicit-SQL production paths now cover ProviderOperation, Chapter, Project, GenerationJob, StageAttempt, OperationPlan, MediaPlan, generation outbox enqueue, Job History, and the Chapter Analyze safety gate
- remaining Spring Data JPA/JDBC boundaries are migration-era surfaces; the outbox dispatcher still deliberately uses JDBC for its short-lived claim/lease query
- Spring Security + server session/CSRF + Google OIDC/password auth
- Redis for Spring Session and transient/non-authoritative hints
- Testcontainers/JUnit/JaCoCo

## Durable authority

PostgreSQL owns authoritative domain/job/plan/usage metadata. Redis generation messages are hints only. Cloudflare R2 owns durable media bytes.

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

Follow `documentation/codebase/PERSISTENCE_MIGRATION.md` and ADR-0015 conventions: explicit row models/result maps/SQL, CAS predicates, affected-row validation and PostgreSQL integration tests. New persistence-heavy features should not deepen JPA/JDBC without a documented exception.

Current high-priority remaining persistence work starts with StoryVersion and quota/billing, then storyboard/continuity and remaining low-risk CRUD/query boundaries.

## Development / verification

```bash
./mvnw clean verify
```

The backend does not execute heavy AI/media/FFmpeg workloads inside HTTP request threads.

Coverage policy, the measured baseline, critical-path expectations, and CI artifact locations are documented in `documentation/codebase/BACKEND_COVERAGE.md`.
