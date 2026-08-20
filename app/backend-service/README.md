# NarrativeX Backend Service

## Purpose

The Backend Service is the core application and domain authority of NarrativeX. It coordinates business workflows, owns authorization and persistence contracts, and serves as the client API boundary. Long-running AI/media work executes asynchronously through durable PostgreSQL execution state and the Python worker.

Creating a Project is metadata-only. Saving a Chapter only persists source. AI analysis is an explicit action scoped to a persisted Chapter.

## Technology Stack

- **Language:** Java 25
- **Framework:** Spring Boot 4.1.0
- **Persistence:** Spring Data JPA, PostgreSQL, Flyway
- **Redis:** Spring Data Redis for transient infrastructure and Spring Session Data Redis for shared HTTP sessions
- **Security:** Spring Security + email/password + Google OIDC + CSRF + server-managed session
- **Observability:** Spring Boot Actuator
- **Document import:** Apache PDFBox for PDF extraction
- **Build:** Maven Wrapper
- **Testing:** JUnit 5, Spring Boot Test, Testcontainers, JaCoCo

## Runtime authority

PostgreSQL is authoritative for durable product and generation state. Redis may store authenticated sessions and non-authoritative delivery/progress/abuse-control state; Redis generation hints never replace durable jobs.

The browser authentication contract is Spring Security server-side session + CSRF. JWT access/refresh tokens are not the current browser contract.

## Chapter Analyze

The implemented Chapter-scoped entry point is:

```http
POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs
```

The backend reloads the persisted Chapter and performs ownership, snapshot, admission and durable-enqueue work before returning `202 Accepted`.

Current durable path:

```text
persisted Chapter
  -> ownership + persisted snapshot validation
  -> safety / entitlement / quota / estimated-cost admission
  -> atomic usage reservation
  -> OperationPlan
  -> GenerationJob
  -> StageAttempt
  -> OutboxEvent
  -> COMMIT
  -> optional Redis delivery hint
  -> Python worker claim/lease/heartbeat
  -> ProviderOperation lifecycle
  -> validated result materialization
```

Project creation never invokes this endpoint or enqueues equivalent AI/media work as a side effect.

## Provider durability

Provider work follows a durable operation lifecycle. A `ProviderOperation` is reserved before external submission and ambiguous external outcomes use `UNKNOWN` plus reconciliation instead of blind resubmission. This is an implemented foundation; broader production recovery/usage reconciliation remains a hardening concern.

## Current Chapter-analysis materialization

The worker currently materializes the structured Chapter analysis into project continuity and storyboard state, including:

- Character / ProjectCharacter / CharacterVersion foundations;
- project-scoped Location identity/materialization;
- Scene / VisualBeat;
- Scene -> ProjectCharacter relations;
- Scene -> Location continuity references.

Full Character review/version locking/reference management and downstream image/TTS/render workflows remain separate product milestones.

## Security profile invariant

Shared configuration does not silently enable a local development identity. When OIDC is disabled, local/test identity behavior requires an explicit `local` or `test` profile. Shared/unknown profiles must fail closed rather than treating requests as a development user.

Password login/register has a separate Redis-backed abuse limiter. Its fail-open behavior on Redis data-access failure does not apply to Spring Session availability.

## Database migration invariant

Flyway migrations are forward-only once shared. The current consolidated development baseline is:

```text
V1__initial_schema.sql
V2__seed_demo_data.sql
```

The active schema does not use the retired StoryVersion rights-attestation columns/table as Analyze/Generate prerequisites.

## Optimistic concurrency

Mutable aggregate persistence uses JPA `@Version` and explicit stale-domain guards where implemented. Public mutable APIs use ETag/`If-Match` where exposed; stale writes must fail instead of silently overwriting newer state.

## Development

Run locally with the explicit local profile:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Windows:

```powershell
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local
```

Run tests/quality gates:

```bash
./mvnw test
./mvnw clean verify
```

`clean verify` runs tests, architecture checks, Spotless and JaCoCo. The coverage threshold is a bootstrap gate, not a claim of comprehensive behavioral coverage.

## Docker

From the repository root, Compose is the preferred local topology:

```bash
docker compose up -d --build backend
```

Compose supplies the explicit local profile and connects the backend to PostgreSQL and Redis. A standalone container must be given reachable database/Redis hosts explicitly.

## Application boundaries

The backend owns domain/business rules, authorization, client API contracts, Flyway migrations and durable generation control-plane state.

It does not own browser rendering or execute heavy AI/media/FFmpeg workloads inside HTTP request threads. Those workloads belong to the asynchronous worker behind durable execution contracts.
