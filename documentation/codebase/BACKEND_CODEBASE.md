# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Persistence: Spring Data JPA + PostgreSQL + Flyway. PostgreSQL remains authoritative; Redis is reconstructable infrastructure.
- Architecture: modular monolith with extraction-oriented feature boundaries plus a separate Python AI/media worker.

## Standard feature layout

```text
feature/
  common/
    api/                    # generic HTTP error/correlation helpers
    domain/                 # shared DDD primitives + domain exception categories
    pagination/             # framework-free cursor primitives
    exception/              # generic resource/application exceptions
    infrastructure/persistence/
    response/               # generic HTTP envelopes

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
      port/in/              # allowed cross-feature in-process contract
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
- Controllers belong to the feature that owns the use case even when the HTTP route is nested under another resource. For example, `/api/v1/projects/{projectId}/analysis-jobs` is owned by Generation, not Project.
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
- database index `idx_projects_owner_updated_id(owner_id, updated_at DESC, id DESC)` supports the access pattern.

`Page`, `Pageable` and Spring Data pagination types must not cross application ports. Framework pagination objects are allowed only inside infrastructure adapters.

## Concurrency and performance

Version creation uses `max(version_number) + 1` while holding a pessimistic lock on the owning `Project`/`Character`. The lock is intentional and protects version allocation from concurrent duplicates; unique constraints remain the final database guard.

Mutable aggregate writes use optimistic `row_version`/JPA `@Version`. Scene is an independent aggregate specifically so unrelated scene edits/generation do not compete for one Chapter aggregate version.

Potential optimization is measurement-driven: if version creation becomes a lock hotspot, replace max-scan numbering with an atomic per-root counter/sequence rather than removing correctness guards.

Project list retrieval uses a composite keyset index and avoids offset scans/count queries. Provider calls remain outside database transactions.

## Code conventions and Lombok usage

- **JPA Entities (`infrastructure/persistence/entity/`)**:
  - Annotated with Lombok `@Getter`, `@Setter`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`.
  - Initialized collection fields (such as aliases and group lists) must be marked with `@Builder.Default` to prevent builders from overriding default instances.
  - Entities do not maintain public domain-accepting constructors; mapping from domain models is performed explicitly via `.builder()...build()` and state mutation via `apply(domainModel)`.
- **Services, Use Cases, Adapters and Controllers**:
  - Use Lombok `@RequiredArgsConstructor` for constructor-based dependency injection on final fields, eliminating verbose manual constructor boilerplate.
  - Logging is standardized via `@Slf4j`.

## Architecture enforcement

`ArchitectureRulesTest` rejects:

- legacy `modules`/`shared` package references in production;
- framework/infrastructure imports in domain;
- domain imports of another business feature's domain;
- business imports from `common`;
- forbidden application/API dependencies;
- misplaced controllers, commands, queries, aggregate roots and entities.

`StoryboardAggregateBoundaryTest` additionally locks the current storyboard aggregate classification and lifecycle invariants.

## CI verification

The repository has GitHub Actions for backend, frontend and worker. Pull requests into `main` run the relevant workflow by path. Backend CI executes Maven `clean verify`; frontend CI executes install/lint/type-check/build`; worker CI executes Ruff, mypy and pytest.

See [ADR-0003](../decisions/ADR-0003-ddd-feature-boundaries-and-api-contracts.md) for general DDD/package decisions and [ADR-0007](../decisions/ADR-0007-storyboard-aggregate-boundaries.md) for the storyboard-specific aggregate decision.
