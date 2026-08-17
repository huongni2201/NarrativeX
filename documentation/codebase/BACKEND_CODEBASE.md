# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven single module under `app/backend-service`.
- Persistence: Spring Data JPA + PostgreSQL + Flyway. PostgreSQL remains authoritative; Redis remains reconstructable infrastructure.
- Backend architecture remains a modular monolith plus a separate Python AI/media worker.

## Current module inventory

| Module | Application boundary | Domain / infrastructure notes |
|---|---|---|
| `modules/auth` | `api -> query -> usecase -> application port` | Owns Spring Security/OIDC/CSRF/session configuration and adapters. Other business modules depend on auth application ports, not `SecurityContextHolder`. |
| `modules/project` | commands for writes, `ProjectListQuery` for list/read, application responses, use cases, `ProjectAccess` internal port | `Project` is an aggregate root. `StoryVersion` is created through Project. Persistence adapters remain under `infrastructure/persistence`. |
| `modules/character` | commands carry owner/actor request context; use cases return `ApiResponse` | Reusable Character identity and ProjectCharacter assignment remain separate from Project ownership. Persistence stays isolated behind application ports. |
| `modules/generation` | enqueue command, job query, application response, use cases | Generation crosses to project through `ProjectAccess`; queued work remains durable and provider calls remain outside transactions. |
| `modules/health` | `ProviderHealthQuery -> GetProviderHealthUseCase`; configuration accessed through `ProviderHealthSettings` port | `ConfiguredProviderHealthSettings` is the infrastructure adapter. Controller no longer reads `@Value`. |
| `modules/storyboard` | application/HTTP layer deliberately deferred | Framework-free storyboard domain entities and infrastructure persistence mappings remain the current baseline. |
| `shared/application/response` | common success/pagination envelopes | Contains `ApiResponse<T>` and `PaginationResponse<T>`. |
| `shared/api` | generic HTTP error/correlation helpers only | Contains `ErrorResponse`, exception handler, error writer/codes, correlation filter. Authentication-specific handlers moved to `modules/auth`. |
| `shared/domain` | framework-free identity bases | `AggregateRoot` and `DomainEntity` are independent; `AggregateRoot` no longer extends `DomainEntity`. |

## Controller -> application convention

Every REST controller follows this boundary:

```text
HTTP request/path/header/pageable
  -> map to Command or Query
  -> useCase.execute(commandOrQuery)
  -> ApiResponse<T>
  -> ResponseEntity sets the HTTP status only
```

Rules:

- write input records live under `application/command` and use `*Command` names;
- read input records live under `application/query` and use `*Query` names;
- actor/owner values received from the HTTP boundary belong to the command/query rather than a second use-case parameter;
- external-facing use cases return `ApiResponse<T>`;
- response DTOs required by application use cases live under `application/response`, not `api/response`;
- controllers do not map domain entities to response DTOs and do not construct success envelopes;
- internal module ports such as `ProjectAccess` are not HTTP APIs and intentionally return domain objects.

## Authentication boundary

Authentication is now a first-class module:

```text
modules/auth/
  api/controller/
  application/
    port/in/
    query/
    response/
    usecase/
  infrastructure/
    configuration/
    security/
```

`CurrentUserId` is an application port. Project, Character and Generation use cases depend on that port. `SecurityContextCurrentUser` is the Spring Security adapter and is the only current business-identity implementation that reads `SecurityContextHolder`/OIDC principals.

This layout is intentional preparation for a future auth-service extraction: replacing the adapter/port integration must not require business modules to import Spring Security types.

## Success and error contracts

Success JSON uses `shared.application.response.ApiResponse<T>`. Paginated success data uses `PaginationResponse<T>`. HTTP status remains authoritative and is selected by the controller (`200`, `201`, `202`, etc.).

Errors remain `shared.api.ErrorResponse` and are written consistently by the exception handler and auth-specific security handlers. SSE, worker-event, media/download and other protocol-specific payloads remain outside the JSON success envelope rule.

## DDD identity convention

`AggregateRoot` and `DomainEntity` are separate framework-free base classes with their own identity/row-version behavior.

- A true aggregate root extends `AggregateRoot`.
- An owned/non-root entity extends `DomainEntity`.
- Do not make an entity an aggregate root merely because of its folder name.
- Do not reintroduce `AggregateRoot extends DomainEntity`.

Existing examples of aggregate roots include `Project`, `Character`, `ProjectCharacter`, `GenerationJob` and `OperationPlan`. Story/project/character/generation child objects keep entity semantics where modeled as entities.

## Dependency direction

- `domain` must not import Spring/JPA/provider/storage dependencies.
- `application` must not import feature `api` or `infrastructure` packages.
- `api` must not import outbound persistence ports or infrastructure implementations.
- persistence implementations live under `infrastructure/persistence/{entity,repository,mapper,adapter}`.
- business modules may cross boundaries only through explicit application ports.
- generic shared code must not import a business module.

`ArchitectureRulesTest` additionally enforces command/query placement, external-facing use-case `ApiResponse` returns, REST-controller placement and the independent AggregateRoot hierarchy.

## API routes preserved by the migration

| Method | Path | Application input | Success response |
|---|---|---|---|
| GET | `/api/v1/projects` | `ProjectListQuery` | `ApiResponse<PaginationResponse<ProjectResponse>>` |
| POST | `/api/v1/projects` | `CreateProjectCommand` | `ApiResponse<ProjectResponse>` / HTTP 201 |
| POST | `/api/v1/projects/{projectId}/stories` | `CreateStoryVersionCommand` | `ApiResponse<StoryVersionResponse>` / HTTP 201 |
| POST | `/api/v1/projects/{projectId}/analysis-jobs` | `EnqueueStoryAnalysisCommand` | `ApiResponse<JobResponse>` / HTTP 202 |
| GET | `/api/v1/jobs/{jobId}` | `GetGenerationJobQuery` | `ApiResponse<JobResponse>` |
| GET | `/api/v1/provider-health` | `ProviderHealthQuery` | `ApiResponse<ProviderHealthResponse>` |
| GET | `/api/auth/me` | `CurrentUserQuery` | `ApiResponse<CurrentUserResponse>` |
| GET | `/api/v1/auth/csrf` | `CsrfTokenQuery` | `ApiResponse<CsrfTokenResponse>` |

## Verification status

Architecture and contract tests were updated together with the migration. The GitHub connector used for this refactor cannot execute Maven locally, so this document does **not** claim that the full `./mvnw test` suite has been executed after the migration. Run backend CI/local Maven tests before merging the migration PR.

See [ADR-0010](../decisions/ADR-0010-application-boundaries-and-auth-module.md) and [DDD_MIGRATION.md](../plans/week-1/DDD_MIGRATION.md) for the governing decision and migration status.
