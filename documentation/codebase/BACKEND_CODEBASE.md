# NarrativeX Backend Codebase

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
| `project.application` | commands, inbound access port and project/story use cases | project controller; generation through `ProjectAccess` | outbound repository ports | resolves owner via `CurrentUserId` | no read/update story API; version allocation is count-plus-one |
| `project.domain.model` | framework-free Project aggregate root, StoryVersion entity and enums | project use cases | no direct database/framework dependency | owner field only | no workspace aggregate/membership |
| `project.infrastructure.persistence` | JPA entities, Spring Data repositories, mappers and outbound adapters | application ports | PostgreSQL project/story tables | translates persistence state to domain | no separate query/read model yet |
| `character.application` | Character commands, ownership checks, version lifecycle and ProjectCharacter assignment use cases | character API/future generation orchestration | character repository ports plus `ProjectAccess` | resolves user ownership through `CurrentUserId` | asset/consent gates remain future bounded contexts |
| `character.domain.model` | Reusable Character identity, ProjectCharacter assignment, immutable CharacterVersion, CharacterAppearance and OutfitVersion | character use cases | no direct database/framework dependency | owner/workspace IDs and immutable lock state | no asset/consent aggregate yet |
| `character.infrastructure.persistence` | JPA entities, Spring Data repositories, mappers and adapters for character identity and assignments | character application ports | PostgreSQL `characters`, `character_versions`, `project_characters`, appearance/outfit tables | scalar IDs preserve module isolation | no read model or generation context resolver yet |
| `generation.api` | job query route and response mapping | frontend/HTTP | generation service | owner-filtered query | no SSE/cancel |
| `generation.application` | commands and enqueue/read job use cases | project/generation controllers | generation outbound repository ports and project inbound access port | owner-filtered project/job lookup | no reservation, idempotency, delivery, claim or worker handoff |
| `generation.domain.model` | GenerationJob and OperationPlan aggregate roots plus stage/provider entities | generation use cases | no direct database/framework dependency | requested/billed user IDs | no worker claim state machine yet |
| `generation.infrastructure.persistence` | JPA entities, repositories, mappers and adapters | application ports | PostgreSQL generation tables | scalar project IDs avoid cross-module ORM links | no durable delivery adapter yet |
| `storyboard.domain.model` | framework-free chapter/scene/visual-beat entities | future storyboard use cases | no direct database/framework dependency | none at API surface | no repositories/controllers/use cases |
| `storyboard.infrastructure.persistence` | JPA table mappings for chapter/scene/visual-beat | future storyboard ports | PostgreSQL tables | scalar parent IDs preserve module isolation | persistence adapter/use cases still pending |
| `health.api` | provider configuration status | frontend/ops | no persistence/provider call | route follows global chain | response says configuration, not real health |
| `shared.api` | basic `ProblemDetail` mapping | all controllers | none | none | no 401/403/404/409/5xx contract or correlation ID |

No provider SDK, web, JPA or storage import is allowed in backend domain model packages. Persistence is now an infrastructure concern and provider work remains outside the domain/application core.

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

- Infrastructure JPA entities use `Long` identity PKs, `@Version` row version, UTC instants and explicit scalar foreign-key IDs. Domain models do not carry JPA annotations or ORM relationships.
- Project, story and generation actions are explicit use cases under `application/usecase`; commands are under `application/command`; transactions remain at use-case boundaries.
- `EnqueueStoryAnalysisUseCase` persists a zero-cost `OperationPlan` and a queued job but does not reserve budget, create stage attempts, or publish a delivery event.
- No repository directly writes Redis or object storage.

## Redis, storage and provider boundary

- Redis is configured but unused in Java source; no cache/queue/progress/lock behavior exists.
- MinIO/S3 is present only in local Compose and environment naming; no storage adapter exists in backend or worker.
- Provider SDKs are absent from the backend. The worker exposes provider ports and a disabled adapter.

## DDD structure and dependency direction

- `Project` is the project aggregate root; it creates `StoryVersion` entities through `createStoryVersion(...)` and rejects creation for archived/unsaved projects.
- `GenerationJob` and `OperationPlan` are separate aggregate roots; generation stores `projectId` as an ID and crosses into project through `project.application.port.in.ProjectAccess`.
- `Character` is reusable at user/workspace scope; `ProjectCharacter` is the project assignment. CharacterVersion is immutable after lock, while appearance/outfit changes stay in their own entities.
- Character persistence stores asset and project references as scalar IDs. Character application services validate ownership through ports and never clone a Character into a Project.
- Application code depends on `application.port.out` repository interfaces. Spring Data JPA implementations live under `infrastructure.persistence` and map between JPA entities and domain models.
- API controllers map HTTP DTOs to application commands and invoke use cases; they do not know Spring Data repositories or JPA entities.
- `ArchitectureRulesTest` checks that domain models are framework-free, application does not import API/infrastructure, API does not import outbound ports/infrastructure, and controllers stay in API packages.
- `ApiExceptionHandler` produces RFC 9457 `ProblemDetail` with stable error codes, message keys, path, instance and correlation ID. Validation exposes structured field violations; not-found, conflict, authorization, unauthenticated and unexpected paths are redacted.
- `CorrelationIdFilter` accepts a bounded safe `X-Correlation-Id` or generates one and returns it in the response header.
- `@Transactional` and `@Transactional(readOnly = true)` remain on application use-case methods; controllers do not own transactions.

## Error handling

The W1-D2 handler maps invalid requests to `INVALID_REQUEST`, bean validation to `VALIDATION_FAILED`, missing resources to `RESOURCE_NOT_FOUND`, resource/optimistic conflicts to `RESOURCE_CONFLICT`, access/identity failures to `ACCESS_DENIED`/`UNAUTHENTICATED`, and unexpected failures to redacted `INTERNAL_ERROR`. Security entry-point and access-denied writers are reusable without changing the W1-D5 authentication model.

## Testing

- `mvn test`: compile and Spring context verification passed after the Character migration; the Spring context test uses H2, `ddl-auto=create-drop`, and Flyway disabled (`src/test/resources/application-test.yml:1-16`). Domain/use-case tests cover reusable identity, immutable lock/pin rules and project assignment. It does not validate real PostgreSQL migrations.
- `mvn -DskipTests package`: produced `target/backend-service-0.0.1-SNAPSHOT.jar` during the audit.
- Real startup against local PostgreSQL 16 failed with `Schema validation: missing table [chapters]`; the DB had no `flyway_schema_history` and no public tables. This is a P0 empty-database boot failure, not an H2 test failure.

## P0/P1 gaps

See `documentation/audits/WEEK_1_TECHNICAL_DEBT.md`. Highest-risk backend items are fail-open local identity/security, empty-DB migration/startup failure, incomplete async handoff, unstable error contracts and missing ownership/workspace enforcement.
