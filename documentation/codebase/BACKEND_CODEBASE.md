# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Persistence: Spring Data JPA + PostgreSQL + Flyway. PostgreSQL remains authoritative for durable business state.
- Redis: Spring Data Redis provides non-authoritative abuse-control/delivery/cache/progress infrastructure, while Spring Session Data Redis stores ephemeral authenticated HTTP session state. Queue/progress state is reconstructable where designed; session loss may sign users out but must not lose durable PostgreSQL business state.
- Architecture: modular monolith with extraction-oriented feature boundaries plus a separate Python AI/media worker.

## Standard feature layout

```text
feature/
  common/
    api/
    domain/
    pagination/
    exception/
    infrastructure/persistence/
    response/

  <feature>/
    api/
      controller/
      request/
      response/
    application/
      command/
      query/
      service/
      usecase/
      port/in/
      port/out/
    domain/
      aggregate/
      entity/
      enums/
      exception/
    infrastructure/
      ...
```

`feature` replaces the legacy `modules` package name. The rename is not itself a microservice architecture: extraction readiness comes from dependency direction and feature ownership.

## Extraction rules

- A business feature owns its API, application, domain and infrastructure vertical slice.
- A feature domain must not import another business feature's domain.
- Cross-feature application dependencies are allowed only through explicit inbound ports (`application.port.in`) while the system remains a modular monolith.
- Controllers belong to the feature that owns the use case even when the HTTP route is nested under another resource. For example, `/api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs` is owned by Generation, not Project or Storyboard.
- Application use cases return application/domain results; they do not return `ApiResponse`, API response DTOs, servlet types or other HTTP transport objects. Controllers perform transport mapping at the API boundary.
- `feature/common` is a deliberately small shared kernel and must not import a business feature.
- Feature-owned value types are duplicated when their meaning belongs to separate bounded contexts. Storyboard therefore owns its aspect-ratio and quality-tier enums instead of importing Project domain enums.

These rules make a future extraction mechanical: replace an inbound in-process port with HTTP/event/messaging integration at the infrastructure boundary without moving domain code.

## Current domain classification

| Feature | Aggregate roots | Entities |
|---|---|---|
| project | `Project` | `StoryVersion` |
| character | `Character`, `ProjectCharacter` | `CharacterVersion`, `CharacterAppearance`, `OutfitVersion` |
| generation | `GenerationJob`, `OperationPlan` | `ProviderOperation`, `StageAttempt` |
| storyboard | `Chapter`, `Scene` | `VisualBeat` |

Storyboard deliberately uses two aggregate boundaries rather than a single giant Storyboard/Chapter object graph. `Chapter` owns chapter-level identity/title/order rules. `Scene` owns scene-level mutable state and lifecycle so independent user/worker updates do not contend on one Chapter version. `VisualBeat` remains a child domain entity. See [ADR-0007](../decisions/ADR-0007-storyboard-aggregate-boundaries.md).

### Chapter analysis boundary

- Creating a `Project` is metadata-only and must not enqueue AI/media work.
- Analysis is explicitly requested for a persisted `Chapter` through `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs`.
- There is no feature toggle that can turn the current scaffold into a production capability.
- The endpoint remains fail-closed with `503 FEATURE_NOT_AVAILABLE` until the durable enqueue transaction, outbox dispatch and worker claim/lease/recovery path exist.
- The current Chapter model still requires source-persistence alignment before production analysis can be enabled; do not paper over that gap by falling back to project-wide analysis.

### Story preflight validation

Story-size validation distinguishes stable failure modes instead of returning only a generic invalid-request response. Character-count and estimated-token limits have separate error codes.

The backend estimator is deliberately conservative for multilingual text and is only a preflight heuristic. It must not be treated as the provider's exact tokenizer. The worker/provider adapter still validates the selected model's real token budget before external execution.

## Domain rules and exceptions

- A true root extends `AggregateRoot` and lives in `domain/aggregate`.
- An owned/non-root entity extends `DomainEntity` and lives in `domain/entity`.
- Enums live in `domain/enums`; business exceptions live in `domain/exception`.
- Domain code remains framework-free.
- Invariants spanning an aggregate are enforced by aggregate factories/methods; application services coordinate authorization, repositories, transactions and external systems.
- Business behavior should be expressed with intent-based methods such as `scene.startGeneration()` and `chapter.reorder(...)`, not unrestricted state setters.
- Aggregate methods must not call repositories, Redis, MinIO/S3, provider SDKs or worker runtimes.
- Domain validation errors extend `DomainValidationException` and map to HTTP 400. State/business conflicts extend `DomainConflictException` and map to HTTP 409.
- Feature-specific exceptions make failed transitions explicit, including `InvalidSceneTransitionException`.

### Storyboard lifecycle

`Scene` follows the canonical V1.8 lifecycle:

```text
DRAFT -> READY_FOR_VISUAL -> GENERATING -> REVIEW -> APPROVED
                           \-> FAILED
APPROVED + mutable edit -> OUTDATED
```

Edits while `GENERATING` or `REVIEW` are rejected by the aggregate. Editing an `APPROVED` scene does not overwrite immutable media history; the mutable Scene becomes `OUTDATED` and downstream affected-scope logic decides what must be regenerated.

## Authentication/session infrastructure

The browser contract is Spring Security server-managed session + CSRF for both password and Google OIDC authentication.

- Spring Session Data Redis stores the authenticated `HttpSession` under the configurable `narrativex:session` namespace by default.
- The browser receives only the opaque `NX_SESSION` cookie; shared/default policy is `HttpOnly`, `Secure`, `SameSite=Lax`, with explicit local/test non-Secure overrides for HTTP development/testing.
- Default session timeout is seven days and configurable through `NARRATIVEX_SESSION_TIMEOUT`.
- Password/OIDC principals must be serializable; password credentials are erased and the password hash is transient before session serialization.
- `POST /logout` invalidates the server session, clears authentication/session cookies and returns 204; CSRF protection still applies.
- Multiple backend replicas can resolve the same session from Redis without sticky sessions.
- Password login/register abuse limiting is separate Redis infrastructure and intentionally fails open on Redis data-access failure. Spring Session availability does not share this fail-open policy.
- JWT access/refresh tokens remain outside the current runtime contract. See ADR-0004 and ADR-0008.

## List API pagination

Collection endpoints use cursor/keyset pagination rather than page-number/offset pagination.

Current Project contract:

```http
GET /api/v1/projects?limit=20&cursor=<opaque-optional-cursor>
```

Response data:

```json
{
  "content": [],
  "nextCursor": null,
  "limit": 20,
  "hasNext": false
}
```

Rules:

- default limit: 20; maximum: 100;
- stable order: `updated_at DESC, id DESC`;
- cursor is opaque Base64URL containing the last `(updatedAt, id)` key;
- persistence fetches `limit + 1` to determine `hasNext`;
- no `OFFSET` and no total-count query are required for normal list navigation;
- active-project listing is supported by the partial index `idx_projects_active_owner_updated_id(owner_id, updated_at DESC, id DESC) WHERE archived_at IS NULL`.

`Page`, `Pageable` and Spring Data pagination types must not cross application ports. Framework pagination objects are allowed only inside infrastructure adapters.

## Concurrency and performance

Version creation uses `max(version_number) + 1` while holding a pessimistic lock on the owning `Project`/`Character`. The lock is intentional and protects version allocation from concurrent duplicates; unique constraints remain the final database guard.

Mutable aggregate writes use optimistic `row_version`/JPA `@Version`. Persistence adapters also compare the detached domain model's expected `rowVersion` against the currently loaded JPA entity version **before** applying domain state. This prevents a stale domain object from overwriting a newer row before Hibernate's normal flush-time optimistic locking can protect it.

The explicit stale-version guard currently covers mutable Project, StoryVersion, Character, CharacterVersion, CharacterAppearance, OutfitVersion, ProjectCharacter, GenerationJob and OperationPlan write paths. Scene is an independent aggregate specifically so unrelated scene edits/generation do not compete for one Chapter aggregate version.

Potential optimization is measurement-driven: if version creation becomes a lock hotspot, replace max-scan numbering with an atomic per-root counter/sequence rather than removing correctness guards.

Project list retrieval uses a partial composite keyset index for the active-project query and avoids offset scans/count queries. Provider calls remain outside database transactions.

## Code conventions and Lombok usage

- **JPA Entities (`infrastructure/persistence/entity/`)**:
  - Annotated with Lombok `@Getter`, `@Setter`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`.
  - Initialized collection fields must use `@Builder.Default` where necessary.
  - Mapping from domain models is explicit through builders/mappers rather than public domain-accepting persistence constructors.
- **Services, Use Cases, Adapters and Controllers**:
  - Prefer constructor-based dependency injection; Lombok `@RequiredArgsConstructor` is appropriate when all constructor dependencies are final and no custom constructor behavior is required.
  - Logging is standardized via `@Slf4j`.

## Architecture enforcement

`ArchitectureRulesTest` rejects:

- legacy `modules`/`shared` package references in production;
- framework/infrastructure imports in domain;
- domain imports of another business feature's domain;
- business imports from `common`;
- forbidden application/API dependencies, including application-layer dependencies on transport response types;
- misplaced controllers, commands, queries, aggregate roots and entities.

`StoryboardAggregateBoundaryTest` additionally locks the current storyboard aggregate classification and lifecycle invariants.

## CI verification

The repository has GitHub Actions for backend, frontend and worker. Pull requests into `main` run the relevant workflow by path. Backend CI executes Maven `clean verify`; frontend CI executes `npm ci`, `npm test`, `npm run lint`, `npm run type-check` and `npm run build`; worker CI executes Ruff, mypy and pytest.

Backend `clean verify` includes tests, Spotless, JaCoCo report generation and a bootstrap bundle-level line-coverage minimum. The current minimum is intentionally modest and must be raised as meaningful behavior coverage grows; passing the threshold is not equivalent to comprehensive test coverage.

Ordinary backend tests exclude Redis Session auto-configuration so the suite does not silently require an external Redis service. Session principal serialization is covered directly; deployed Redis-session integration validation belongs to the environment/Compose integration path.

See [ADR-0001](../decisions/ADR-0001-system-topology-and-durable-execution.md) for durable execution, [ADR-0002](../decisions/ADR-0002-chapter-first-workflow-and-routes.md) for chapter-first analysis/routes, [ADR-0003](../decisions/ADR-0003-ddd-feature-boundaries-and-api-contracts.md) for general DDD/package decisions, [ADR-0007](../decisions/ADR-0007-storyboard-aggregate-boundaries.md) for storyboard aggregate boundaries, and [ADR-0008](../decisions/ADR-0008-redis-backed-http-sessions.md) for shared HTTP session persistence.
