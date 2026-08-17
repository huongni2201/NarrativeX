# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Persistence: Spring Data JPA + PostgreSQL + Flyway. PostgreSQL remains authoritative; Redis is reconstructable infrastructure.
- Architecture: modular monolith plus a separate Python AI/media worker.

## Standard module layout

```text
modules/
  common/
    api/                    # generic HTTP error/correlation helpers
    domain/                 # AggregateRoot, DomainEntity
    exception/
    infrastructure/persistence/
    response/               # ApiResponse, PaginationResponse

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
    infrastructure/
      ...
```

Folders are created only when the module needs them. `domain/aggregate` is not a generic bucket for every domain class.

## Current domain classification

| Module | Aggregate roots | Entities |
|---|---|---|
| project | `Project` | `StoryVersion` |
| character | `Character`, `ProjectCharacter` | `CharacterVersion`, `CharacterAppearance`, `OutfitVersion` |
| generation | `GenerationJob`, `OperationPlan` | `ProviderOperation`, `StageAttempt` |
| storyboard | none yet | `Chapter`, `Scene`, `VisualBeat` |

Storyboard intentionally has no invented root until a real consistency/transaction boundary is defined.

## Controller/application convention

```text
HTTP input
  -> Controller maps Request/path/header/pageable to Command or Query
  -> UseCase.execute(commandOrQuery)
  -> ApiResponse<feature api.response DTO>
  -> Controller selects HTTP status
```

- Commands: `application/command/*Command`.
- Queries: `application/query/*Query`.
- Generic envelopes: `modules/common/response`.
- Feature HTTP DTOs: `<feature>/api/response`.
- Application may reference its own module's API response DTO by project convention, but never API controllers/requests, another module's response DTOs, or infrastructure implementations.
- Internal ports such as `ProjectAccess` are not HTTP APIs and may return domain objects.

## Common module rule

`modules/common` is a small shared kernel/cross-cutting module, not a dumping ground. It may hold generic identity primitives, response envelopes, generic exceptions, API error/correlation helpers and common persistence auditing. Business concepts, business enums and feature workflows stay inside their owning module. `common` must not import a business module.

## Domain rules

- A true root extends `AggregateRoot` and lives in `domain/aggregate`.
- An owned/non-root entity extends `DomainEntity` and lives in `domain/entity`.
- Enums live in `domain/enums`.
- Domain code is framework-free and does not import Spring/JPA/provider/storage infrastructure.
- Aggregate factories/methods guard invariants; application services coordinate authorization, repositories, locks and transactions.

Examples of enforced invariants include positive IDs/version numbers, valid generation progress/cost ranges, rights checks before StoryVersion activation, archived-root mutation protection, and CharacterVersion lock validation before state mutation.

## Concurrency/performance notes

Version creation currently uses `max(version_number) + 1` while holding a pessimistic lock on the owning `Project`/`Character`. The lock is intentional: removing it would make concurrent version creation race. Unique constraints remain the final database guard. Project list paging is bounded to 100 rows per request.

Potential future optimization should be measurement-driven: if version creation becomes a lock hotspot, replace max-scan numbering with an atomic per-root counter/sequence rather than weakening consistency.

## Authentication

`modules/auth` owns controller, query/use-case ports and Spring Security/OIDC/CSRF infrastructure. Business modules depend on `auth.application.port.in.CurrentUserId`, not `SecurityContextHolder`.

Auth response DTOs live in `auth/api/response`. Generic security error JSON is provided by `modules/common/api`; Spring Security-specific handlers remain under auth infrastructure.

## Architecture enforcement

`ArchitectureRulesTest` rejects legacy `shared` references, feature `application/response`, misplaced commands/queries/controllers, framework imports in domain, aggregate/entity folder mismatches, `domain/aggregate/enums`, business imports from `common`, and forbidden application/API dependencies.

## Verification status

The GitHub connector used for this migration cannot run Maven locally, and this repository currently has no PR workflow providing test evidence. Therefore this document does not claim `./mvnw test` passed. Run backend Maven tests before merging.

See [ADR-0011](../decisions/ADR-0011-module-package-and-aggregate-boundaries.md) and [DDD_MIGRATION.md](../plans/week-1/DDD_MIGRATION.md).
