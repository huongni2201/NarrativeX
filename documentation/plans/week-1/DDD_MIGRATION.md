# DDD migration status

## Scope

This migration corrects backend module/application boundaries without changing public routes, Flyway schema ownership, PostgreSQL authority or provider behavior.

## Completed

- `AggregateRoot` and `DomainEntity` are independent framework-free identity bases. Aggregate roots extend `AggregateRoot`; non-root entities extend `DomainEntity`.
- `Project` is an aggregate root; `StoryVersion` is an entity created through the Project boundary.
- `GenerationJob` and `OperationPlan` are aggregate roots. Generation references projects by stable ID through the project application access port.
- Commands live in `application/command`; queries live in `application/query` and use `*Command` / `*Query` naming.
- Controller request/path/header data is mapped into a command or query before application execution.
- External-facing use cases return `ApiResponse<T>`. Success envelopes and pagination models live in `shared/application/response`.
- Feature response DTOs used by application logic live in `application/response`, not `api/response`.
- `ProjectAccessService` implements the internal cross-module `ProjectAccess` port and intentionally returns domain objects instead of HTTP envelopes.
- Authentication/security code is isolated under `modules/auth`; business modules depend on auth application ports rather than Spring Security implementation classes.
- Provider health now has query/use-case/port/infrastructure boundaries instead of configuration logic inside its controller.
- Character use cases follow the same command + `ApiResponse` convention; owner/actor request context is carried by the command.
- Persistence contracts remain in `application/port/out`; JPA entities, repositories, mappers and adapters remain under `infrastructure/persistence`.
- Architecture tests enforce dependency direction, command/query placement, use-case envelopes and the aggregate-root inheritance rule.

## Deliberately deferred

- Storyboard commands, repositories and HTTP use cases.
- Workspace membership and full production identity persistence.
- PostgreSQL migration/startup validation and Testcontainers coverage.
- Durable queue delivery, worker lease/reconciliation and provider adapters.

## Invariants preserved

- Existing table/column names, identity keys, row-version columns and Flyway ownership remain unchanged.
- Story content limits, rights-attestation fields, owner filtering and the queue-only generation contract remain in place.
- No external provider call is introduced inside a transaction.
- Existing REST routes and success-envelope JSON shape remain stable.

See [ADR-0010](../../decisions/ADR-0010-application-boundaries-and-auth-module.md) for the current cross-cutting boundary rules.
