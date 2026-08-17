# ADR-0004: DDD aggregates and persistence adapters

## Status

Accepted

## Context

The first backend slice placed JPA entities and Spring Data repositories beside the domain classes. Application services consequently exposed persistence-shaped models and combined several commands, while cross-module code could accidentally depend on another module's repository. This made the domain dependent on Jakarta Persistence and made unit testing the business rules harder than necessary.

## Decision

Use a package-by-capability DDD structure inside the modular monolith:

- `domain.model` contains framework-free aggregates/entities and business invariants.
- `application.command` contains use-case input commands; `application.usecase` owns orchestration and transaction boundaries.
- `application.port.in` exposes intentional cross-module application contracts.
- `application.port.out` abstracts persistence and other driven dependencies.
- `infrastructure.persistence` contains JPA entities, Spring Data repositories, adapters and mappers.
- Cross-module relationships use stable IDs and explicit application ports; generation does not import project persistence classes or map an ORM relationship to another module.

The first migrated aggregates are `Project`, `GenerationJob` and `OperationPlan`. `StoryVersion` is an entity owned by `Project`; storyboard persistence mappings are moved out of the domain while storyboard use cases remain future work.

## Consequences

### Positive

- Domain tests run without Spring, JPA or a database.
- Database and ORM changes are isolated in infrastructure adapters.
- Controllers depend on use cases and commands rather than repositories.
- Module boundaries are explicit and enforceable with source-level architecture tests.

### Negative

- Each persistence-backed model now has a JPA entity and a mapper, increasing file count.
- New fields must be updated in both domain and persistence representations.
- Existing read/write use cases need explicit projections later rather than returning ORM graphs.

## Migration and follow-up

No database migration is required because table names, columns, keys and Flyway ownership remain unchanged. Future slices should add storyboard use cases and adapters through the same ports, then apply the pattern to additional bounded contexts before adding provider integrations.

## Related decisions

- [ADR-0001: Modular monolith and separated AI/media worker](./ADR-0001-modular-monolith-and-worker.md)
- [ADR-0002: PostgreSQL authoritative state and durable provider operations](./ADR-0002-durable-state-and-provider-operations.md)
