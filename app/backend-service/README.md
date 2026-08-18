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

## Authentication runtime contract

The current backend authentication contract is still **Spring Security server-side session + CSRF**. Password login/registration and Google OIDC resolve to the internal NarrativeX user identity and persist authentication in the server-managed session.

This branch intentionally does **not** migrate authentication to JWT, access tokens or refresh tokens. Any future token-based authentication migration must be handled as a separate compatibility/security change with an explicit API rollout, refresh-token rotation/revocation policy and frontend migration plan.

Credentialed browser mutations continue to use CSRF protection. The CSRF bootstrap endpoint is `GET /api/v1/auth/csrf`; password login/registration remain under `/api/auth/*` until a separate API-versioning/auth migration is approved.

### Password auth abuse protection

`POST /api/auth/login` and `POST /api/auth/register` are protected by a Redis-backed fixed-window limiter before authentication or account creation.

The limiter uses atomic Redis Lua increment/expiry operations and SHA-256 bucket subjects so raw email/IP values are not stored in Redis keys. It maintains separate IP and identity+IP buckets.

Default policy:

| Endpoint | Bucket | Default |
|---|---|---:|
| Login | IP | 30 requests / 5 minutes |
| Login | identity + IP | 10 requests / 5 minutes |
| Register | IP | 10 requests / hour |
| Register | identity + IP | 5 requests / hour |

When a bucket is exceeded the API returns `429 Too Many Requests`, the existing structured `ErrorResponse`, and `Retry-After`.

Redis data-access failure is intentionally **fail-open** for this limiter so a Redis outage does not become a total authentication outage. That tradeoff must be covered by infrastructure monitoring and edge/gateway protection in shared environments. The default `test` profile disables the external Redis limiter so ordinary Spring tests do not require a Redis service; focused limiter tests should exercise the limiter separately.

Limits are configuration, not domain invariants, and may be changed under `narrativex.security.auth-rate-limit.*` without changing the authentication contract.

## Database migration invariant

Flyway migrations are forward-only once shared. Historical migrations V1-V6 are not edited to remove released schema state.

`V6__drop_legacy_story_rights_columns.sql` removes the obsolete StoryVersion rights columns. `V7__drop_legacy_content_rights_attestations.sql` removes the remaining legacy `content_rights_attestations` table. The active product/domain contract has no blanket per-story copyright/rights-attestation prerequisite for Analyze/Generate; moderation, report/review/takedown and real-person consent remain independent concerns.

The PostgreSQL Testcontainers migration test runs with the explicit `test` profile while overriding the test datasource/dialect back to PostgreSQL, then validates the complete Flyway path and Hibernate schema compatibility.

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
