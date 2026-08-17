# DDD migration status

## Scope

Normalize backend module/package semantics without intentionally changing public routes, Flyway schema ownership, PostgreSQL authority or provider behavior.

## Completed

- All cross-cutting backend code moved from root `shared` into the small `modules/common` shared kernel.
- `AggregateRoot` and `DomainEntity` remain independent framework-free identity bases.
- Feature response DTOs live in `api/response`; generic `ApiResponse<T>` and pagination live in `modules/common/response`.
- Commands/queries use `application/command` and `application/query`; controllers map HTTP input before use-case execution.
- `Project` is a root; `StoryVersion` is an entity.
- `Character` and `ProjectCharacter` are roots; character version/appearance/outfit objects are entities.
- `GenerationJob` and `OperationPlan` are roots; provider operation/stage attempt objects are entities.
- Storyboard `Chapter`, `Scene`, and `VisualBeat` are entities. No artificial storyboard aggregate root was introduced.
- Domain enums are under `domain/enums` rather than aggregate packages.
- Domain invariants were tightened for IDs/order/version/progress/cost/state transitions.
- CharacterVersion lock now validates actor input before mutating status/lock metadata.
- Existing pessimistic owner locks are retained around `max(version)+1` numbering to prevent concurrent version races.
- Architecture tests enforce the normalized layout and reject legacy `shared` references.

## Deliberately deferred

- A storyboard aggregate root until an actual consistency boundary is defined.
- Storyboard application/HTTP use cases.
- Workspace membership/full production identity persistence.
- Durable queue delivery, worker lease/reconciliation and provider adapters.
- Changing version allocation to an atomic counter/sequence; current locking is correct and should be optimized only with evidence of contention.

## Verification

No Maven/CI pass is claimed for this migration because the GitHub connector cannot execute Maven and the repository currently has no PR workflow providing test evidence. Run `./mvnw test` (or `mvnw.cmd test`) before merge.

See [ADR-0011](../../decisions/ADR-0011-module-package-and-aggregate-boundaries.md).
