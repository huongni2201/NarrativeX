# NarrativeX Backend Service

## Purpose
The Backend Service is the core application and domain authority of NarrativeX. It coordinates business workflows, manages persistence, enforces authorization and business rules, and serves as the single API gateway for clients. Long-running generation is asynchronous, but production job creation remains disabled until the durable enqueue/worker path is implemented and verified.

## Technology Stack
- **Language**: Java 25
- **Framework**: Spring Boot 4
- **Persistence**: Spring Data JPA, PostgreSQL 18, PostgreSQL Driver, Flyway Migration
- **Caching & Messaging**: Redis 8 via Spring Data Redis
- **Security**: Spring Security
- **Observability**: Spring Boot Actuator
- **Build Tool**: Maven with Maven Wrapper
- **Testing**: JUnit 5, Spring Boot Test, Testcontainers

## Local Prerequisites
- Java 25+ JDK installed
- Maven 3.9+ (or use included `./mvnw` / `mvnw.cmd`)
- Docker (optional, for running local PostgreSQL and Redis or Testcontainers)

## Security profile invariant

The shared application configuration does **not** default to the `local` profile. When OIDC is disabled, startup is allowed only with an explicit `local` and/or `test` profile. No profile, an unknown profile, or a shared-environment profile must fail closed rather than assigning every request to `local-dev-user`.

Local development therefore has to opt in explicitly.

## Development Commands

### Run Locally

```bash
# Unix
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

```powershell
# Windows
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local
```

Equivalent environment-variable form:

```bash
SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
```

PowerShell:

```powershell
$env:SPRING_PROFILES_ACTIVE = "local"
.\mvnw.cmd spring-boot:run
```

### Run Tests
```bash
# Unix
./mvnw test

# Windows
.\mvnw.cmd test
```

### Build JAR Package
```bash
# Unix
./mvnw clean package

# Windows
.\mvnw.cmd clean package
```

### Build & Run with Docker

From the repository root, the recommended local workflow is:

```powershell
docker compose up -d --build backend
```

The local Compose file explicitly supplies `SPRING_PROFILES_ACTIVE=local` by default. This is a local-development convenience and does not change the fail-closed rule of the shared backend artifact.

The Compose backend is wired to the `postgres` and `redis` services and waits for both healthchecks before starting.

To build the backend image by itself:

```bash
docker build -t narrativex-backend-service ./app/backend-service

docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=local \
  -e DB_HOST=host.docker.internal \
  -e REDIS_HOST=host.docker.internal \
  narrativex-backend-service
```

The standalone container command assumes PostgreSQL and Redis are reachable from Docker through `host.docker.internal`; Compose is preferred because it provides service discovery, health ordering and named volumes.

## Story analysis feature gate

`POST /api/v1/projects/{projectId}/analysis-jobs` is disabled by default with:

```yaml
narrativex:
  features:
    story-analysis-enabled: false
```

The environment override is `NARRATIVEX_STORY_ANALYSIS_ENABLED`. Do **not** enable it in a shared environment until the durable enqueue transaction, StageAttempt/outbox dispatch, worker claim/lease/heartbeat path, provider-operation reconciliation, entitlement/quota, abuse/safety gates and cost authorization/reservation are implemented and integration-tested.

When disabled, the endpoint returns `503 FEATURE_NOT_AVAILABLE` and must not create a fake `QUEUED` job.

## Application Boundaries
- **Must Own**: Domain models, business rule validation, project state, database schema and migrations (Flyway), client API endpoints, authorization and durable job control-plane state.
- **Must NOT Own**: Direct GPU/media processing, FFmpeg video rendering execution, direct interaction with heavy Python AI inference libraries (delegated asynchronously to `ai-worker`), browser UI rendering (owned by `frontend-web`).
