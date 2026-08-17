# ADR-0010: Application command/query boundaries and auth module isolation

- Status: Accepted
- Date: 2026-08-18
- Scope: Spring Boot application layer, REST controllers, authentication module, domain base classes

## Context

The backend had several inconsistent boundaries: controllers sometimes constructed `ApiResponse` and mapped domain objects themselves, query records could live under `application/command`, actor IDs were passed beside commands, authentication code was split across `configuration`, `shared/api` and `shared/security`, and `AggregateRoot` inherited `DomainEntity` without adding an independent aggregate-root identity contract.

Those inconsistencies make module extraction harder and allow each feature to invent its own controller/use-case convention.

## Decision

1. REST controllers map HTTP inputs (`request`, path variables, headers and pageable input) into one application `Command` or `Query` before invoking a use case.
2. Commands live in `application/command`; queries live in `application/query`. Request-scoped actor/owner identifiers are part of the command/query instead of extra use-case parameters.
3. External-facing use cases return `ApiResponse<T>`. `ApiResponse` and `PaginationResponse` live in `shared/application/response`, not the API package.
4. Feature response models consumed by use cases live in each module's `application/response`. Controllers must not force application code to import an API package.
5. Internal cross-module ports such as `ProjectAccess` remain domain/application contracts and return domain objects; they are not HTTP envelopes.
6. Authentication is a first-class `modules/auth` boundary. Other modules depend only on auth application ports. Spring Security, OIDC, CSRF/session configuration and `SecurityContextHolder` access live under auth infrastructure/API packages.
7. `AggregateRoot` and `DomainEntity` are separate framework-free identity bases. An aggregate root extends `AggregateRoot`; an owned/non-root entity extends `DomainEntity`. `AggregateRoot` does not extend `DomainEntity`.
8. Provider-health configuration is accessed through an application port with an infrastructure adapter; the health controller no longer reads configuration directly.

## Consequences

- Controller methods become thin HTTP adapters and preserve HTTP status while returning the use-case envelope.
- Feature modules can add controllers without duplicating mapping/envelope rules.
- Moving auth to a dedicated deployable service later requires replacing application ports/adapters rather than untangling shared packages.
- Query/command naming is machine-checkable by architecture tests.
- No public JSON envelope, route, Flyway schema, PostgreSQL authority or provider execution behavior changes in this migration.

## Follow-up

Storyboard currently has framework-free domain entities but no implemented application/HTTP use cases. When those use cases are added, they must follow this ADR from their first commit.
