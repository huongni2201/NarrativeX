# ADR-0011: Module package and aggregate boundaries

- Status: Accepted
- Date: 2026-08-18
- Scope: backend module layout, shared kernel, API responses, domain aggregate/entity packages
- Supersedes: package-location portions of ADR-0010 items 3 and 4

## Context

The backend had converged on a module-first architecture but package names no longer reflected domain semantics. Shared cross-cutting code lived outside `modules`, feature response DTOs were split between API and application packages, and several classes extending `DomainEntity` were physically placed in `domain/aggregate`. This made the tree misleading and weakened automated architecture checks.

## Decision

1. All backend feature and cross-cutting modules live under `com.narrativex.backend.modules`.
2. `modules/common` is a deliberately small shared kernel/cross-cutting module. It may contain generic response envelopes, generic API error/correlation infrastructure, framework-free identity bases, generic exceptions, and common persistence audit infrastructure. It must not contain feature business concepts or import business modules.
3. Feature HTTP response DTOs live in `<feature>/api/response`. Generic `ApiResponse<T>` and `PaginationResponse<T>` live in `modules/common/response`.
4. As a project convention, an application use case may return its own module's `api/response` DTO. Application code must not import API controllers/requests, another module's API response package, or infrastructure implementations.
5. Domain packages describe semantics, not table shape: true aggregate roots live in `domain/aggregate`, owned/non-root entities live in `domain/entity`, and enums live in `domain/enums`.
6. Current aggregate roots are `Project`, `Character`, `ProjectCharacter`, `GenerationJob`, and `OperationPlan`.
7. Current non-root entities are `StoryVersion`, `CharacterVersion`, `CharacterAppearance`, `OutfitVersion`, `ProviderOperation`, `StageAttempt`, `Chapter`, `Scene`, and `VisualBeat`.
8. Storyboard currently has no introduced aggregate root. A root will be added only when an actual transaction/consistency boundary is defined; no artificial root is created for package symmetry.
9. Aggregate constructors/factories guard business invariants that must hold regardless of caller, while application services coordinate repositories, authorization, transactions, and cross-module ports.

## Consequences

- `shared` is removed after callers migrate to `modules/common`.
- `application/response` packages are removed from current feature modules.
- Folder placement now communicates aggregate ownership and is machine-checkable.
- Existing public routes, success-envelope JSON shape, Flyway schema, PostgreSQL authority, and provider execution model are unchanged.
- `ArchitectureRulesTest` enforces the package rules and rejects legacy `shared` references.

## Verification

The migration was structurally reviewed through the GitHub connector. Maven/CI was not executable in this connector environment and the repository currently has no PR workflow that can be used as test evidence. Run `./mvnw test` (or `mvnw.cmd test` on Windows) before merging.
