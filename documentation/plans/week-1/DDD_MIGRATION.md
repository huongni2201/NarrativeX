# DDD migration status

## Scope

This migration corrects the backend structure for the active `project`, `generation` and `storyboard` slices without changing public routes, Flyway schema ownership, PostgreSQL authority or provider behavior.

## Completed

- `Project` is a framework-free aggregate root. `StoryVersion` is an entity created through the Project aggregate boundary.
- `GenerationJob` and `OperationPlan` are framework-free aggregate roots. Generation references projects by stable ID and uses the project application access port for ownership checks.
- Commands live in `application/command` and orchestration lives in `application/usecase`.
- Persistence contracts live in `application/port/out`; cross-module access uses `application/port/in`.
- JPA entities, Spring Data repositories, mappers and adapters live under `infrastructure/persistence`.
- Storyboard domain classes are framework-free; their current JPA mappings are infrastructure-only until storyboard use cases are implemented.
- Architecture tests reject JPA/framework imports from domain models and reject API/application dependencies on infrastructure persistence.

## Deliberately deferred

- Storyboard commands, repositories and HTTP use cases.
- Workspace membership and production authentication enforcement.
- PostgreSQL migration/startup validation and Testcontainers coverage.
- Durable queue delivery, worker lease/reconciliation and provider adapters.

## Invariants preserved

- Existing table/column names, identity keys, row-version columns and Flyway ownership remain unchanged.
- Story content limits, rights-attestation fields, owner filtering and the queue-only generation contract remain in place.
- No external provider call is introduced inside a transaction.

See [ADR-0004](../../decisions/ADR-0004-ddd-aggregates-and-persistence-adapters.md) for the cross-cutting structure decision.
