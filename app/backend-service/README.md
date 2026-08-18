# NarrativeX Backend Service

## Purpose
The Backend Service is the core application and domain authority of NarrativeX. It coordinates business workflows, manages persistence, enforces authorization and business rules, and serves as the single API gateway for clients. Long-running generation is asynchronous, but production job creation remains disabled until the durable enqueue/worker path is implemented and verified.

## Technology Stack
- **Language**: Java 25
- **Framework**: Spring Boot 4
- **Persistence**: Spring Data JPA, PostgreSQL 18, PostgreSQL Driver, Flyway Migration
- **Redis**: Redis 8 via Spring Data Redis for abuse-control/delivery/cache/progress and Spring Session Data Redis for shared HTTP sessions
- **Security**: Spring Security + email/password + Google OIDC + CSRF + server-managed session
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

The current backend authentication contract is **Spring Security server-side session + CSRF**. Password login/registration and Google OIDC resolve to the internal NarrativeX user identity and persist authentication in the server-managed session.

This runtime does **not** use JWT access tokens or refresh tokens. Any future token-based authentication migration must be handled as a separate compatibility/security change with an explicit API rollout, refresh-token rotation/revocation policy and frontend migration plan.

Credentialed browser mutations continue to use CSRF protection. The CSRF bootstrap endpoint is `GET /api/v1/auth/csrf`; password login/registration remain under `/api/auth/*` until a separate API-versioning/auth migration is approved.

### Redis-backed HTTP session

Spring Session Data Redis replaces process-local servlet session storage while preserving the existing browser contract.

- Browser cookie: `NX_SESSION`.
- Default shared cookie policy: `HttpOnly`, `Secure`, `SameSite=Lax`.
- The explicit `local` profile and test configuration allow `Secure=false` for HTTP localhost/test usage only.
- Default session timeout: `7d`, configurable with `NARRATIVEX_SESSION_TIMEOUT`.
- Default Redis namespace: `narrativex:session`, configurable with `NARRATIVEX_SESSION_REDIS_NAMESPACE`.
- Password and OIDC principals are serializable for Redis session storage; password credentials are erased and the password-hash field is transient so the hash is not persisted into session state.
- `POST /logout` invalidates the server session, clears authentication, removes `NX_SESSION`/`XSRF-TOKEN`, and returns `204 No Content`. CSRF still applies to logout.
- Multiple backend instances can resolve the same authenticated session through Redis without sticky sessions.

Redis is therefore an availability dependency for authenticated session reads/writes. Losing the session namespace may sign users out, but it does not remove durable user/project/business state from PostgreSQL.

Ordinary tests exclude Redis session auto-configuration so the default test suite does not silently require an external Redis instance. Session-principal serialization is covered separately.

See `documentation/decisions/ADR-0008-redis-backed-http-sessions.md`.

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

Redis data-access failure is intentionally **fail-open for this limiter only** so a Redis outage does not become a total authentication-entry outage. This is distinct from Redis-backed Spring Session: authenticated session access does not use the limiter's fail-open behavior. Shared environments must monitor Redis and may layer stricter edge/gateway protection independently.

The default `test` profile disables the external Redis limiter so ordinary Spring tests do not require a Redis service; focused limiter tests should exercise the limiter separately.

Limits are configuration, not domain invariants, and may be changed under `narrativex.security.auth-rate-limit.*` without changing the authentication contract.

## Database migration invariant

Flyway migrations are forward-only once shared. Historical migrations are not edited to remove released schema state.

The current migration path includes a consolidated V1 baseline and forward migrations through V7. `V6__drop_legacy_story_rights_columns.sql` removes the obsolete StoryVersion rights columns. `V7__drop_legacy_content_rights_attestations.sql` removes the remaining legacy `content_rights_attestations` table. The active product/domain contract has no blanket per-story copyright/rights-attestation prerequisite for Analyze/Generate; moderation, report/review/takedown and real-person consent remain independent concerns.

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

The Compose backend is wired to the `postgres` and `redis` services and waits for both healthchecks before starting. It also passes the configurable Spring Session timeout/namespace to the backend.

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
