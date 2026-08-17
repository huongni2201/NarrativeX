# NarrativeX W1-D1 Backend Baseline

## Framework/runtime

- Java runtime verified: `25.0.3`.
- Spring Boot parent: `4.1.0`; Maven: `3.9.16` installed. `mvn` works after dependency download; the Windows wrapper fails before Maven with `Cannot index into a null array` in `mvnw.cmd:35`.
- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven, single module `app/backend-service`.
- Persistence: Spring Data JPA + PostgreSQL driver + Flyway; Redis starter and Actuator are configured.

## Module inventory

| Module | Responsibility | Incoming | Outgoing / DB ownership | Security ownership | Violations/gaps |
|---|---|---|---|---|---|
| `project.api` | HTTP DTOs and project/story routes | frontend/HTTP | project service | passes owner header to service | controller still exposes client owner header in local mode |
| `project.application` | project/story use cases and limits | project controller | project/story repositories | resolves owner via `CurrentUserId` | no read/update story API; version allocation is count-plus-one |
| `project.domain` | JPA project/story entities and enums | service/repository | PostgreSQL tables | owner field only | no workspace aggregate/membership |
| `generation.api` | job query route and response mapping | frontend/HTTP | generation service | owner-filtered query | no SSE/cancel |
| `generation.application` | operation-plan/job insert and owner-filtered lookup | project/generation controllers | generation/project repositories | owner-filtered project/job lookup | no reservation, idempotency, delivery, claim or worker handoff |
| `storyboard.domain` | chapter/scene/visual-beat JPA entities | JPA scan only | PostgreSQL tables | none at API surface | no repositories/controllers/use cases |
| `health.api` | provider configuration status | frontend/ops | no persistence/provider call | route follows global chain | response says configuration, not real health |
| `shared.api` | basic `ProblemDetail` mapping | all controllers | none | none | no 401/403/404/409/5xx contract or correlation ID |

No provider SDK import was found in backend domain/application packages. This satisfies the provider-boundary rule at the current scaffold level.

## API inventory

| Method | Path | Controller | Auth | Workspace scoped | Request | Response | Persistence | Transaction | Used by FE | Risk/gap |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/projects` | `ProjectController#list` | local open; OIDC chain authenticated | owner string, no workspace | optional `X-User-Id` | `ProjectResponse[]` | real JPA query | read-only | client function exists, no caller | client header unsafe in local mode; no pagination |
| POST | `/api/v1/projects` | `ProjectController#create` | local open; OIDC chain authenticated | owner string, no workspace | `CreateProjectRequest` | `ProjectResponse` | real JPA insert | write transaction | only unreachable `StudioDashboard` | no idempotency |
| POST | `/api/v1/projects/{projectId}/stories` | `ProjectController#createStory` | local open; OIDC chain authenticated | project owner check | `CreateStoryVersionRequest` | `StoryVersionResponse` | real JPA insert | write transaction | client function exists, no caller | no story read/update; no If-Match |
| POST | `/api/v1/projects/{projectId}/analysis-jobs` | `ProjectController#analyze` | local open; OIDC chain authenticated | project owner check | no body | `JobResponse` | `OperationPlan` + `GenerationJob` insert | write transaction | client function exists, no caller | zero-cost plan; no reservation/queue/worker |
| GET | `/api/v1/jobs/{jobId}` | `GenerationJobController#get` | local open; OIDC chain authenticated | job joins project owner | no body | `JobResponse` | real JPA query | read-only | no | no progress producer; no SSE |
| GET | `/api/v1/provider-health` | `ProviderHealthController#get` | local open; OIDC chain authenticated | none | no body | configured flag/location/model map | config only | none | no | no external call; not provider health |

Concrete route evidence is in `src/main/java/com/narrativex/backend/modules/project/api/ProjectController.java:18-55`, `.../generation/api/GenerationJobController.java:10-24`, and `.../health/api/ProviderHealthController.java:9-34`.

## Security

- `SecurityConfig.localSecurityFilterChain` permits `/actuator/**`, `/api/v1/**` and every other route (`SecurityConfig.java:37-48`). It is selected by default when `narrativex.security.oidc-enabled` is absent/false (`application.yml:37-39`). There is no profile guard forcing OIDC outside local development.
- OIDC mode uses an HttpOnly server session shape (`SecurityConfig.java:22-35`) but CSRF is disabled for both chains. This remains an unresolved cookie-auth assumption.
- `CurrentUserId.resolve` trusts `X-User-Id` whenever OIDC is disabled (`CurrentUserId.java:24-27`). OIDC correctly ignores the header and reads `Authentication` (`:29-35`), but local mode is unsafe if reachable beyond a private developer machine.
- Controllers have no workspace membership concept; the current filter is a string owner ID on project/job rows.
- Actuator web exposure is `health,info,metrics` (`application.yml:47-54`); health details are `when_authorized`, but local security makes actuator routes open.

## Persistence and transactions

- JPA entities use `Long` identity PKs, `@Version` row version, UTC instants and lazy parent relationships.
- Project list/create, story create and analysis enqueue have explicit `@Transactional` boundaries. Job read and project list are read-only transactions.
- `GenerationApplicationService.enqueueStoryAnalysis` persists a zero-cost `OperationPlan` and a queued job but does not reserve budget, create stage attempts, or publish a delivery event.
- No repository directly writes Redis or object storage.

## Redis, storage and provider boundary

- Redis is configured but unused in Java source; no cache/queue/progress/lock behavior exists.
- MinIO/S3 is present only in local Compose and environment naming; no storage adapter exists in backend or worker.
- Provider SDKs are absent from the backend. The worker exposes provider ports and a disabled adapter.

## W1-D2 architecture and error boundary

- `ProjectApplicationService` consumes `CreateProjectCommand` and `CreateStoryVersionCommand`; controllers perform the HTTP DTO mapping.
- `GenerationApplicationService` consumes `ProjectAccess` from `project.application`; it no longer imports `ProjectRepository`.
- `ArchitectureRulesTest` checks dependency direction and controller placement on every test run.
- `ApiExceptionHandler` produces RFC 9457 `ProblemDetail` with stable error codes, message keys, path, instance and correlation ID. Validation exposes structured field violations; not-found, conflict, authorization, unauthenticated and unexpected paths are redacted.
- `CorrelationIdFilter` accepts a bounded safe `X-Correlation-Id` or generates one and returns it in the response header.
- `@Transactional` and `@Transactional(readOnly = true)` remain on application use-case methods; controllers do not own transactions.

## Error handling

The W1-D2 handler maps invalid requests to `INVALID_REQUEST`, bean validation to `VALIDATION_FAILED`, missing resources to `RESOURCE_NOT_FOUND`, resource/optimistic conflicts to `RESOURCE_CONFLICT`, access/identity failures to `ACCESS_DENIED`/`UNAUTHENTICATED`, and unexpected failures to redacted `INTERNAL_ERROR`. Security entry-point and access-denied writers are reusable without changing the W1-D5 authentication model.

## Testing

- `mvn test`: 4 tests passed; the Spring context test uses H2, `ddl-auto=create-drop`, and Flyway disabled (`src/test/resources/application-test.yml:1-16`). It does not validate real PostgreSQL migrations.
- `mvn -DskipTests package`: produced `target/backend-service-0.0.1-SNAPSHOT.jar` during the audit.
- Real startup against local PostgreSQL 16 failed with `Schema validation: missing table [chapters]`; the DB had no `flyway_schema_history` and no public tables. This is a P0 empty-database boot failure, not an H2 test failure.

## P0/P1 gaps

See `documentation/audits/WEEK_1_TECHNICAL_DEBT.md`. Highest-risk backend items are fail-open local identity/security, empty-DB migration/startup failure, incomplete async handoff, unstable error contracts and missing ownership/workspace enforcement.
