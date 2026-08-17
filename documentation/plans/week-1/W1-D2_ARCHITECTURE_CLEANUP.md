# W1-D2 — Architecture and API Boundary Cleanup

## Objective

Make module ownership enforceable while preserving the existing UI and modular monolith. This is a focused boundary cleanup, not a rewrite.

## Target boundaries

```text
Spring Boot modular monolith
  modules/<capability>/
    api/             HTTP DTOs and controllers
    application/     commands, queries and transaction boundary
    domain/          business rules; no Spring Web/provider SDK
    repository/      domain persistence ports/interfaces
    infrastructure/  JPA, Redis, storage and vendor adapters
  shared/
    api/              RFC 9457 errors and pagination contracts
    security/         authenticated actor and authorization helpers
    domain/           minimal stable primitives
```

Capabilities planned for the product remain `identity/auth`, `workspace`, `project/story`, `character`, `storyboard`, `asset`, `generation/job`, `render`, `entitlement`, `usage`, `safety`, `notification` and `shared`. Week 1 only creates packages needed by implemented code; do not generate empty layers for every future module.

## Backend tasks

### 1. Freeze dependency rules

**Files:**

- Modify: `app/backend-service/src/main/java/com/narrativex/backend/modules/**`
- Create: module boundary tests under `app/backend-service/src/test/java/com/narrativex/backend/architecture/`
- Update: `documentation/architecture/SERVICE_BOUNDARIES.md`

- [ ] Document allowed dependencies: `api -> application -> domain`; infrastructure implements inward-facing ports.
- [ ] Keep provider SDKs, Redis clients and storage clients out of domain packages.
- [ ] Prevent worker/runtime dependencies from entering the backend domain.
- [ ] Add automated architecture tests (ArchUnit or an equivalent package-level test) for rules that can regress.
- [ ] Test one deliberately invalid fixture or rule assertion so the guard is proven effective.

### 2. Standardize HTTP contracts

**Files:**

- Modify: `shared/api/ApiExceptionHandler.java`
- Create: shared error-code and pagination DTOs only when used by an endpoint
- Modify: implemented controllers and response DTOs
- Create/modify: MVC contract tests

- [ ] Use RFC 9457 `application/problem+json` with stable `code`, `messageKey`, `status`, `path`, `correlationId` and optional field violations.
- [ ] Map validation to `400`, unauthenticated to `401`, forbidden to `403`, missing resource to `404`, optimistic conflict to `409`, throttling to `429` with retry metadata and unexpected failure to a non-sensitive `500`.
- [ ] Never expose exception class names, SQL, provider payloads, tokens or raw sensitive prompts.
- [ ] Define page parameters and response metadata once an actual list endpoint needs pagination; do not wrap single-resource responses unnecessarily.
- [ ] Add tests for validation, unknown resource, conflict, denial and generic error redaction.

### 3. Make transaction ownership explicit

**Files:**

- Modify: application services under `modules/**/application/`
- Modify: repositories/entities only when required by a demonstrated issue
- Create/modify: application integration tests

- [ ] Place `@Transactional` at application use-case boundaries, not controllers.
- [ ] Keep external provider calls outside open database transactions.
- [ ] Keep `spring.jpa.open-in-view=false` and return DTOs instead of lazy entities from controllers.
- [ ] Require idempotency keys for retryable commands when those commands are introduced.
- [ ] Test rollback and optimistic-lock conflict behavior for changed use cases.

## Frontend tasks

### 4. Consolidate the API boundary without rewriting screens

**Files:**

- Modify: `app/frontend-web/src/lib/api.ts`
- Create as needed: `src/features/<feature>/api.ts`, query keys and typed hooks
- Modify: screens currently calling mocks directly
- Create/modify: frontend tests when a test runner is established

- [ ] Keep base URL, credentials, content negotiation and `ProblemDetail` parsing in one HTTP client.
- [ ] Split feature-specific calls near their feature only after `api.ts` becomes difficult to own; avoid speculative layers.
- [ ] Centralize query keys and invalidate only affected project/story data.
- [ ] Keep authentication in HttpOnly cookies; never store Google/provider tokens in Zustand or local storage.
- [ ] Mark remaining mock paths explicitly and ensure they cannot run in staging/production unnoticed.

### 5. Clarify client state ownership

- [ ] TanStack Query owns server state; Zustand owns short-lived UI/editor state only.
- [ ] Stable backend codes are localized at presentation time for `vi-VN` and `en-US`.
- [ ] UI visibility is convenience only; server authorization remains authoritative.
- [ ] Remove dead exports/dependencies only when D1 provides evidence and the relevant build passes.
- [ ] Add regression coverage for changed API/error behavior or record the test-runner setup as a scoped prerequisite.

## Decisions requiring an ADR

Create an ADR before implementing any of the following:

- changing modular-monolith boundaries across multiple modules;
- introducing a new inter-module event/command mechanism;
- changing the identifier strategy;
- changing session/authentication architecture;
- adding a second schema owner or moving canonical state outside PostgreSQL.

## Acceptance criteria

- [ ] Package ownership and dependency direction are documented and automatically checked.
- [ ] Current controllers return consistent, non-sensitive problem responses.
- [ ] Transaction boundaries live in application services.
- [ ] Frontend API calls share credentials/error parsing and mocks are identifiable by environment.
- [ ] Backend domain imports no provider SDK, storage client or Python runtime dependency.
- [ ] Narrow tests and the full repository checks in [`README.md`](./README.md) pass.

