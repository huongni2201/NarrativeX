# ADR-0010: Application command/query boundaries and auth module isolation

- Status: Accepted; package-location items 3-4 partially superseded by ADR-0011
- Date: 2026-08-18
- Scope: Spring Boot application layer, REST controllers, authentication module, domain base classes

## Context

The backend had inconsistent controller/use-case boundaries, command/query placement, authentication ownership, and aggregate-root identity semantics.

## Decision

1. REST controllers map HTTP request/path/header/pageable inputs into one application `Command` or `Query` before invoking a use case.
2. Commands live in `application/command`; queries live in `application/query`. Actor/owner identifiers received at the HTTP boundary belong to that command/query instead of separate use-case parameters.
3. External-facing use cases return `ApiResponse<T>`.
4. Internal cross-module ports such as `ProjectAccess` remain application contracts and return domain objects rather than HTTP envelopes.
5. Authentication is a first-class `modules/auth` boundary. Other business modules depend on auth application ports, while Spring Security/OIDC/CSRF/session implementation stays under auth infrastructure/API.
6. `AggregateRoot` and `DomainEntity` are separate framework-free identity bases; `AggregateRoot` does not extend `DomainEntity`.
7. Provider-health configuration is accessed through an application port and infrastructure adapter rather than directly from its controller.

Response/package locations originally chosen by this ADR have been superseded by [ADR-0011](./ADR-0011-module-package-and-aggregate-boundaries.md): generic envelopes now live in `modules/common/response`, and feature HTTP response DTOs live in `<feature>/api/response`.

## Consequences

Controllers stay thin, command/query naming is machine-checkable, auth can later be extracted behind its application ports, and aggregate-root semantics remain distinct from child entity semantics. Public routes and JSON envelope shape are not intentionally changed.
