# NarrativeX — W1-D2 Architecture Boundary & Frontend API Foundation

> Historical W1-D2 plan. The subsequent DDD persistence migration is tracked in `DDD_MIGRATION.md` and ADR-0004; the pre-migration observations below are retained as implementation evidence.

> **Status:** READY TO IMPLEMENT  
> **Week:** Week 1 — Foundation & Clean  
> **Day:** W1-D2  
> **Repository:** `huongni2201/NarrativeX`  
> **Target branch:** `main` baseline, implement on a dedicated feature branch  
> **Baseline inspected:** `e192278e7f25139041a51f1b3d5ff67f2d955c97`  
> **Primary objective:** Enforce architecture/API ownership boundaries and prepare the existing frontend for safe API integration without redesigning the UI or implementing Week 2 features.

---

## 0. Source-of-truth contract

The implementation agent MUST read and reconcile the following before changing code.

### Priority 1 — repository instructions

1. `AGENTS.md`
2. `AI_CONTEXT.md`
3. `CONTRIBUTING.md`
4. `app/frontend-web/AGENTS.md`

Important frontend rule: this repository uses a Next.js version whose APIs/conventions may differ from model memory. Before writing Next.js code, read the relevant documentation from:

```text
app/frontend-web/node_modules/next/dist/docs/
```

Do not code Next.js behavior from memory when local framework documentation is available.

### Priority 2 — product and architecture

1. `documentation/product/PRODUCT_SPEC.md`
2. `documentation/product/NARRATIVEX_WEEK_1_2_IMPLEMENTATION_TIMELINE.md`
3. `documentation/architecture/SYSTEM_ARCHITECTURE.md`
4. `documentation/architecture/SERVICE_BOUNDARIES.md`
5. `documentation/architecture/DATA_FLOW.md`
6. `documentation/architecture/TECHNOLOGY_STACK.md`
7. `documentation/domain/BUSINESS_RULES.md`
8. `documentation/domain/DOMAIN_MODEL.md`
9. `documentation/domain/GLOSSARY.md`
10. relevant ADRs under `documentation/decisions/`

### Priority 3 — W1 audit and implementation baseline

1. `documentation/plans/week-1/README.md`
2. `documentation/plans/week-1/W1-D1_REPOSITORY_AUDIT_UPDATED.md`
3. `documentation/audits/WEEK_1_TECHNICAL_DEBT.md`
4. `documentation/audits/WEEK_1_SECURITY_AUDIT.md`
5. `documentation/audits/WEEK_1_NO_REFACTOR.md`
6. `documentation/codebase/CODEBASE_MAP.md`
7. `documentation/codebase/BACKEND_CODEBASE.md`
8. `documentation/codebase/FRONTEND_CODEBASE.md`
9. `documentation/codebase/FRONTEND_API_INTEGRATION_MATRIX.md`
10. `documentation/codebase/AI_WORKER_CODEBASE.md`
11. `documentation/codebase/DATABASE_BASELINE.md`

### Priority 4 — current implementation

The current code on the implementation branch is authoritative for **what exists now**.

In particular, inspect the complete current frontend under:

```text
app/frontend-web/src/
```

Do not trust an older audit statement when the current code proves it has changed.

### Conflict resolution

When sources disagree:

1. Product/domain/architecture invariants win over implementation convenience.
2. Current code wins over stale audit text for factual statements such as current files, routes, imports, rendered screens, and package versions.
3. Existing frontend visual behavior is the UI source of truth.
4. Update stale implementation-facing Markdown when current code has moved.
5. Do not silently reinterpret a cross-cutting architecture decision. If a true architectural decision changes, create an ADR first.

---

# 1. W1-D2 objective

W1-D2 converts the audited scaffold into an enforceable architecture baseline.

At the end of D2:

```text
Existing NarrativeX UI
        |
        | typed HTTP boundary
        v
Spring Boot API
        |
        v
Application use cases
        |
        v
Domain + persistence boundary

+ automated package/dependency guards
+ stable ProblemDetail contract
+ explicit module-to-module access
+ transaction ownership confirmed
+ frontend Query/API foundation
+ mocks explicitly classified
+ current docs synchronized with current FE
```

W1-D2 is **not** the day to finish product integration.

---

# 2. Non-negotiable scope boundaries

## 2.1 Must do

- synchronize W1-D1 documentation with the latest frontend code where drift is proven;
- enforce modular-monolith dependency rules with automated backend tests;
- remove concrete dependency-direction violations found in current code;
- standardize the backend HTTP error boundary;
- preserve application-service transaction ownership;
- prepare a typed frontend HTTP/error/query foundation;
- clearly separate API DTOs/server state from existing UI/mock state;
- make mock usage explicit and environment-aware;
- preserve the current frontend design and component hierarchy;
- update documentation/evidence for every implemented boundary;
- run narrow verification and full supported checks for changed areas.

## 2.2 Must not do

Do **not**:

- redesign, restyle, replace, or regenerate existing frontend screens;
- rewrite the frontend into a new route architecture;
- implement Google OIDC/session ownership from W1-D5;
- fix the PostgreSQL/Flyway W1-D4 migration baseline unless a D2 change directly causes a regression;
- build the W1-D3 full Docker/local environment;
- implement real Project/Story vertical-slice wiring from W2-D1;
- implement upload/storage APIs from W2-D2;
- implement queue/lease/worker/SSE from W2-D3/W2-D4;
- integrate real AI/image/video/TTS providers;
- create empty packages for every future domain module;
- change the identifier strategy;
- introduce microservices;
- move canonical state away from PostgreSQL;
- expose provider credentials in frontend code;
- add speculative abstractions that have no current caller.

---

# 3. Verified starting point that D2 must respect

Before implementation, re-verify these facts against the branch.

## Backend

Current backend shape includes:

```text
app/backend-service/
  modules/
    project/
      api/
      application/
      domain/
      repository/
    generation/
      api/
      application/
      domain/
      repository/
    storyboard/
      domain/
    health/
      api/
  shared/
    api/
    domain/
    security/
```

Important current facts:

- Spring Boot application services already contain `@Transactional` boundaries.
- `ProjectApplicationService` currently imports HTTP request DTOs from `project.api`.
- `GenerationApplicationService` currently reaches directly into `ProjectRepository`.
- repository interfaces currently extend Spring Data `JpaRepository`.
- `ApiExceptionHandler` only handles argument/validation failures.
- no architecture guard test currently protects dependency direction.
- PostgreSQL migration/startup is a W1-D4 gate, not a D2 refactor target.
- fail-open local authentication is a W1-D5 security gate, not permission to redesign auth in D2.

## Frontend

Current frontend stack must be taken from `package.json`, not stale README text.

Expected baseline:

```text
Next.js 16.x
React 19.x
TypeScript 5.x
Zustand 5.x
TanStack Query 5.x
```

Current visible root app renders the existing studio UI and includes current Asset Library and Style Presets screens.

Current state patterns include:

- `useStudioStore` owns mock projects, characters, wizard state, navigation and local auth state;
- `useProductionStore` owns mock project/chapter/visual-beat data and local mutations;
- `useAssetStore` owns mock asset records and client-only review mutations;
- `usePresetStore` owns preset mock/business-like state;
- `src/lib/api.ts` contains the small existing fetch client;
- TanStack Query is installed but not yet established as the server-state owner;
- current UI must remain visually unchanged by D2.

---

# 4. D2 deliverables

| ID | Deliverable | Required |
|---|---|---|
| D2-01 | Updated W1-D2 plan aligned with current code | YES |
| D2-02 | Updated FE baseline + API integration matrix where stale | YES |
| D2-03 | Automated backend architecture dependency tests | YES |
| D2-04 | Removal of current `application -> api` dependency violation | YES |
| D2-05 | Removal of current cross-module repository reach-through | YES |
| D2-06 | Stable backend ProblemDetail/error contract | YES |
| D2-07 | Backend HTTP contract tests for changed behavior | YES |
| D2-08 | Frontend typed API error/client boundary | YES |
| D2-09 | TanStack Query provider/client foundation | YES |
| D2-10 | Explicit API DTO vs UI-model separation | YES |
| D2-11 | Explicit mock data-mode policy | YES |
| D2-12 | W1-D2 verification evidence | YES |
| D2-13 | Technical-debt register updated only where evidence changed | YES |

---

# 5. Implementation sequence

Implement in this order. Do not start with broad refactoring.

---

## Track A — Synchronize the source of truth with current FE

### A1. Re-audit only files changed since W1-D1

Inspect:

```text
app/frontend-web/src/app/page.tsx
app/frontend-web/src/features/**
app/frontend-web/src/components/**
app/frontend-web/src/store/**
app/frontend-web/src/lib/**
app/frontend-web/src/types/**
app/frontend-web/package.json
app/frontend-web/README.md
```

Also inspect the latest commits since the W1-D1 audit snapshot.

### A2. Update stale frontend documentation

Update at minimum:

```text
documentation/codebase/FRONTEND_CODEBASE.md
documentation/codebase/FRONTEND_API_INTEGRATION_MATRIX.md
documentation/audits/WEEK_1_TECHNICAL_DEBT.md
```

Known drift to re-check:

- Assets and Presets are now rendered by the current root page, so they must not remain classified as `DEAD` merely because the older audit did not render them.
- `app/frontend-web/README.md` must match the package manifest/framework version.
- step/component names in W1-D1 docs must match actual files.
- navigation entries still having no functional implementation should remain explicitly classified as `DEAD`, `MOCK`, or `PLANNED` based on evidence.

### A3. Do not rewrite history

W1-D1 remains an audit artifact.

When updating audit-derived docs:

- preserve the original finding ID;
- update evidence/status with a dated note;
- do not delete old evidence just because the implementation changed;
- only mark a finding `VERIFIED` when its closure test is actually satisfied.

### Acceptance — Track A

- current rendered screens in docs match current code;
- current package versions match `package.json`;
- no matrix row claims a screen is dead when current `page.tsx` renders it;
- remaining dead/mock rows are evidence-backed.

---

# 6. Track B — Backend architecture enforcement

## B1. Add automated architecture tests first

Create:

```text
app/backend-service/src/test/java/com/narrativex/backend/architecture/
```

Suggested test files:

```text
ArchitectureRulesTest.java
ModuleDependencyRulesTest.java
```

Use ArchUnit or an equivalent package-level architecture test.

If adding ArchUnit:

- select a Java 25-compatible release;
- pin the dependency intentionally;
- do not guess a version from model memory;
- keep it test-scope only.

### Required rules

#### Rule B1.1 — application must not depend on HTTP API packages

Forbidden:

```text
..modules.<module>.application..
    -> ..modules.<module>.api..
```

Reason: HTTP request/response DTOs are adapters. Application use cases must accept application commands/queries or domain-safe inputs.

Current expected violation to remove:

```text
ProjectApplicationService
  -> CreateProjectRequest
  -> CreateStoryVersionRequest
```

#### Rule B1.2 — API must not reach repositories directly

Forbidden:

```text
..api..
  -> ..repository..
```

Controllers call application use cases.

#### Rule B1.3 — one module must not reach another module's repository

Forbidden example:

```text
generation.application
  -> project.repository
```

Cross-module interaction must go through an explicit application-facing contract/facade owned by the target module.

#### Rule B1.4 — domain packages must not import web/provider/runtime infrastructure

At minimum, backend domain packages must not depend on:

```text
org.springframework.web..
org.springframework.data.redis..
redis.clients..
io.minio..
software.amazon.awssdk..
provider/vendor SDK namespaces
Python/worker runtime packages
FFmpeg wrapper/runtime packages
```

Do not ban `jakarta.persistence` in D2 merely to force a persistence rewrite. Current JPA entity/persistence cleanup belongs to the reviewed persistence baseline and W1-D4 unless a specific D2 violation requires change.

#### Rule B1.5 — shared must remain small

`shared` must not depend inward on a business module.

Allowed direction:

```text
business modules -> shared
```

Forbidden:

```text
shared -> modules.project
shared -> modules.generation
...
```

#### Rule B1.6 — controllers live under API packages

Classes annotated as REST controllers should reside in the module API adapter package.

### Architecture test strategy

1. Add rules while current violations still exist.
2. Confirm the relevant rules fail.
3. Fix the concrete violations.
4. Re-run and confirm they pass.
5. Record commands/results in W1-D2 evidence.

Do not commit a permanently broken fixture into production source.

If a "rule proves it can fail" test is needed, use a test-only fixture/package that does not pollute production packages.

---

# 7. Track B2 — Remove `application -> api` coupling

## Current issue

`ProjectApplicationService` accepts:

```text
CreateProjectRequest
CreateStoryVersionRequest
```

from the HTTP API package.

This reverses the intended dependency direction.

## Target

Create application-level command/input records, for example:

```text
modules/project/application/CreateProjectCommand.java
modules/project/application/CreateStoryVersionCommand.java
```

or a similarly small structure consistent with existing repository style.

Controller responsibility:

```text
HTTP request DTO
   |
   | validate/map
   v
application command
   |
   v
ProjectApplicationService
```

Application responsibility:

```text
command
  -> business validation
  -> domain construction
  -> repository
```

### Requirements

- HTTP DTOs remain in `project.api`.
- application package must not import `project.api`.
- do not duplicate validation without reason;
- Bean Validation remains at the HTTP boundary where appropriate;
- business/domain invariants remain in application/domain code;
- keep request-to-command mapping simple and explicit;
- do not introduce a mapper framework for two small DTOs.

### Tests

Update/add tests proving:

- valid create project still works;
- valid story version creation still works;
- HTTP validation still returns stable problem details;
- architecture test proves `application -> api` is forbidden.

---

# 8. Track B3 — Remove cross-module repository reach-through

## Current issue

`GenerationApplicationService` directly imports:

```text
modules.project.repository.ProjectRepository
```

This violates module ownership.

## Target

The `project` module owns project lookup/ownership semantics.

Expose the minimum application-facing contract needed by generation.

Recommended shape:

```text
project.application.ProjectAccess
  or
project.application.ProjectQueryService
```

Example responsibility:

```text
requireOwnedProject(projectId, actorId)
```

Generation may depend on that project application contract, but it must not call the project repository directly.

### Guardrails

Do not:

- expose `ProjectRepository` as a shared service;
- move repository interfaces into `shared`;
- add a generic "RepositoryRegistry";
- introduce event infrastructure just for this read;
- change authentication architecture;
- rewrite project ownership into workspace membership in D2.

Workspace membership belongs to W1-D5 unless current product docs require a minimal type boundary only.

### Acceptance

Search must return no cross-module repository import from generation:

```powershell
rg -n "modules\.project\.repository" app/backend-service/src/main/java/com/narrativex/backend/modules/generation
```

Expected result: none.

---

# 9. Track B4 — Standard backend HTTP ProblemDetail contract

## B4.1 Contract

Use RFC 9457 `application/problem+json`.

Every API problem response produced by the shared error boundary should expose stable machine-readable fields.

Minimum shape:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Human-safe detail",
  "instance": "/api/v1/...",
  "code": "VALIDATION_FAILED",
  "messageKey": "api.validation.failed",
  "path": "/api/v1/...",
  "correlationId": "..."
}
```

Validation may additionally contain:

```json
{
  "violations": [
    {
      "field": "name",
      "code": "NotBlank",
      "messageKey": "validation.name.NotBlank"
    }
  ]
}
```

Do not expose raw stack traces, SQL, exception class names, credentials, provider payloads, tokens, user prompts, or internal object dumps.

## B4.2 Stable initial codes

Implement only codes supported by current behavior.

Recommended D2 baseline:

```text
INVALID_REQUEST
VALIDATION_FAILED
RESOURCE_NOT_FOUND
RESOURCE_CONFLICT
ACCESS_DENIED
UNAUTHENTICATED
INTERNAL_ERROR
```

Do not add dozens of speculative error codes.

## B4.3 Exceptions

Prefer narrow application exceptions over reusing `IllegalArgumentException` for unrelated semantics.

Examples:

```text
ResourceNotFoundException
ResourceConflictException
```

Do not create a deep exception hierarchy.

## B4.4 Mapping

D2 should cover changed/current paths for:

| Condition | HTTP | Stable code |
|---|---:|---|
| malformed/business-invalid request | 400 | `INVALID_REQUEST` |
| bean validation failure | 400 | `VALIDATION_FAILED` |
| owned resource not found | 404 | `RESOURCE_NOT_FOUND` |
| optimistic/version conflict | 409 | `RESOURCE_CONFLICT` |
| authorization denial | 403 | `ACCESS_DENIED` |
| unauthenticated request | 401 | `UNAUTHENTICATED` |
| unexpected error | 500 | `INTERNAL_ERROR` |

Security enforcement itself remains W1-D5. D2 may establish reusable handlers/writers for 401/403 without converting local auth architecture.

## B4.5 Correlation ID

Add a minimal request correlation boundary if none exists.

Recommended behavior:

```text
request
  -> accept a valid X-Correlation-Id when present
  -> otherwise generate one
  -> store as request attribute
  -> return as response header
  -> include in ProblemDetail
```

Constraints:

- validate/sanitize client-provided values;
- reject or replace unreasonably long/invalid values;
- do not use correlation ID as authorization data;
- structured logging expansion may remain W2-D5.

Suggested files:

```text
shared/api/ApiErrorCode.java
shared/api/ApiProblemFactory.java
shared/api/FieldViolation.java
shared/api/CorrelationIdFilter.java
shared/api/ApiExceptionHandler.java
```

Names may vary; keep the layer small.

---

# 10. Track B5 — Transaction ownership review

The application services already use Spring transactions.

D2 should preserve and verify that shape rather than performing a transaction rewrite.

Required checks:

- write use cases have `@Transactional` at application boundary;
- read use cases use `@Transactional(readOnly = true)` where useful;
- controllers contain no transaction boundary;
- no external provider call happens inside an open DB transaction;
- `spring.jpa.open-in-view=false` remains enforced if already configured;
- API returns DTOs rather than exposing lazy JPA entities directly;
- changed conflict behavior is translated to stable HTTP 409.

Do not change persistence/schema strategy in this track.

---

# 11. Track B6 — Backend tests

Add narrow deterministic tests.

Suggested tests:

```text
architecture/ArchitectureRulesTest.java
shared/api/ApiExceptionHandlerTest.java
shared/api/CorrelationIdFilterTest.java
modules/project/api/ProjectControllerContractTest.java
modules/generation/application/GenerationApplicationServiceTest.java
```

Use the smallest Spring test slice possible.

D2 should not depend on the broken fresh-PostgreSQL migration gate from W1-D4 for architecture/error tests.

Test at minimum:

- architecture rules pass;
- validation -> 400 + `VALIDATION_FAILED`;
- not-found -> 404 + `RESOURCE_NOT_FOUND`;
- conflict -> 409 + `RESOURCE_CONFLICT`;
- generic exception -> 500 without sensitive detail;
- correlation ID appears in response and problem payload;
- generation no longer reaches project repository directly;
- current successful project/story/job behavior remains compatible.

---

# 12. Track C — Frontend API boundary

## C1. Preserve the current UI

Do not:

- redesign pages;
- rename screens for aesthetics;
- replace Tailwind/component styling;
- regenerate design-system components;
- change sidebar/header layout;
- replace the current wizard;
- convert the app to a different routing model during D2.

The frontend is a product surface to integrate, not a design task.

---

# 13. Track C2 — Typed API problem handling

Current `src/lib/api.ts` only extracts `ProblemDetail.detail`.

Extend it into a typed boundary while keeping one owner for HTTP behavior.

Suggested API types:

```ts
export interface ApiFieldViolation {
  field: string;
  code?: string;
  messageKey?: string;
}

export interface ApiProblem {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  messageKey?: string;
  path?: string;
  correlationId?: string;
  violations?: ApiFieldViolation[];
}
```

`ApiClientError` should retain:

```text
status
code
messageKey
correlationId
problem
```

### Request helper requirements

Centralize:

- `NEXT_PUBLIC_API_BASE_URL`;
- `credentials: "include"`;
- `Accept` header;
- JSON content type only when a body is actually JSON;
- RFC 9457 problem parsing;
- safe fallback when response is not JSON;
- 204/no-content handling when introduced;
- no token storage;
- no provider secret access;
- no direct browser access to Redis/PostgreSQL/storage/provider.

Do not add axios if `fetch` is already sufficient.

---

# 14. Track C3 — Separate API DTOs from UI models

Current mock UI IDs and fields differ from backend responses.

Do not force the existing visual model to become identical to backend DTOs.

Create a clear API contract type boundary, for example:

```text
src/types/api.ts
```

or feature-local API types when justified.

Rules:

```text
backend DTO model != presentation model
```

Examples to preserve intentionally:

- backend project IDs may currently be numeric;
- mock/presentation IDs may currently be string IDs such as `proj-1`;
- project cards need presentation-only fields not yet present in backend;
- story response shape is not yet sufficient for the final editor.

D2 should create the type boundary and prevent accidental conflation.

Actual adapters/mappers should be added only when a real W2 screen is wired.

---

# 15. Track C4 — Establish TanStack Query foundation

TanStack Query is already a dependency but is not yet the server-state owner.

Add a minimal provider boundary without wiring every screen.

Suggested files:

```text
src/app/providers.tsx
src/lib/query-client.ts
src/lib/query-keys.ts
```

or equivalent names consistent with current code.

Root layout:

```text
RootLayout
  -> AppProviders
     -> QueryClientProvider
        -> existing children
```

Query defaults should be conservative.

Recommended behavior:

- do not retry client 4xx errors;
- avoid aggressive refetch loops;
- use stable query keys;
- keep server state out of Zustand when W2 integrations begin;
- do not migrate all current mock stores during D2.

No new state library.

---

# 16. Track C5 — State ownership contract

After D2, document/enforce this rule:

## TanStack Query owns

- projects returned by backend;
- story versions returned by backend;
- server assets;
- generation jobs;
- server analysis result;
- server character/storyboard resources;
- backend loading/error/retry/refetch state.

## Zustand owns

- current local screen selection until routing is intentionally migrated;
- wizard draft before persistence;
- filters/search text when not URL state;
- modal/drawer open state;
- selection/batch UI state;
- temporary editor UI state not yet persisted.

## Zustand must not become the final authority for

- durable projects;
- durable chapters;
- durable assets;
- approved/rejected server records;
- generation job status;
- entitlement;
- authentication truth.

Do not migrate all current mocks in D2. Mark them as mock/prototype state and prepare the boundary for W2.

---

# 17. Track C6 — Explicit mock data mode

Current UI uses mock data heavily. D2 must make that mode explicit so staging/production cannot silently appear healthy while using fake local business data.

Introduce one small runtime configuration contract.

Example:

```text
NEXT_PUBLIC_NX_DATA_MODE=mock|api
```

Policy:

```text
application runtime (development/staging/production):
  default to api
  mock is rejected

test/Storybook:
  may use mock explicitly
```

Implementation must keep `npm run build` passing.

Acceptable approaches:

- initialize mock datasets only when `DATA_MODE === "mock"`;
- default API mode for every application runtime;
- allow mock mode only in test or Storybook runtimes;
- ensure production mode does not present mock project/job/asset data as real persisted state;
- fail clearly on an explicitly invalid data-mode configuration;
- document the mode in `.env.example` and frontend README.

Do not expose secrets through this flag.

Do not add a visual redesign just to label mock mode.

---

# 18. Track C7 — Do not perform W2 API integration early

D2 may prepare:

```text
API client
ProblemDetail parsing
QueryClient
query keys
API DTO types
mock/runtime mode
```

D2 should **not** complete:

```text
Dashboard -> GET projects
Wizard -> POST project
Story -> POST/GET/PUT story
Asset -> upload
Analysis -> enqueue + poll/SSE
Render -> real job
```

Those remain mapped to Week 2.

A tiny internal proof call may be used only if required to validate the client contract and does not convert a visible user flow into partial unofficial integration.

---

# 19. Track D — Documentation and architecture records

## D1. Update

```text
documentation/plans/week-1/W1-D2_ARCHITECTURE_CLEANUP.md
documentation/architecture/SERVICE_BOUNDARIES.md
documentation/codebase/BACKEND_CODEBASE.md
documentation/codebase/FRONTEND_CODEBASE.md
documentation/codebase/FRONTEND_API_INTEGRATION_MATRIX.md
documentation/audits/WEEK_1_TECHNICAL_DEBT.md
app/frontend-web/README.md
```

Only update `SYSTEM_ARCHITECTURE.md` if D2 exposes an actual inconsistency.

## D2. ADR decision gate

Create an ADR before implementing any of the following:

- a new cross-module messaging mechanism;
- a new identifier strategy;
- a new authentication/session architecture;
- a new database/schema owner;
- a microservice extraction;
- changing PostgreSQL as canonical state;
- changing the worker authority boundary.

The recommended D2 `project application facade/query contract` is consistent with the existing service-boundary rule and should not require a new ADR unless the agent changes the overall inter-module mechanism.

---

# 20. Exact file-impact guide

The agent must inspect before editing. This list is a guide, not permission to create every file.

## Backend likely modified

```text
app/backend-service/pom.xml

app/backend-service/src/main/java/com/narrativex/backend/modules/project/api/**
app/backend-service/src/main/java/com/narrativex/backend/modules/project/application/**

app/backend-service/src/main/java/com/narrativex/backend/modules/generation/application/**

app/backend-service/src/main/java/com/narrativex/backend/shared/api/**
```

## Backend likely added

```text
app/backend-service/src/test/java/com/narrativex/backend/architecture/**
app/backend-service/src/test/java/com/narrativex/backend/shared/api/**
```

Potential small application contracts:

```text
modules/project/application/CreateProjectCommand.java
modules/project/application/CreateStoryVersionCommand.java
modules/project/application/ProjectAccess.java
```

Names may be adjusted to match repository conventions.

## Frontend likely modified

```text
app/frontend-web/src/app/layout.tsx
app/frontend-web/src/lib/api.ts
app/frontend-web/src/types/**
app/frontend-web/.env.example
app/frontend-web/README.md
```

## Frontend likely added

```text
app/frontend-web/src/app/providers.tsx
app/frontend-web/src/lib/query-client.ts
app/frontend-web/src/lib/query-keys.ts
app/frontend-web/src/lib/data-mode.ts
app/frontend-web/src/types/api.ts
```

Do not create feature API files merely to satisfy a folder diagram if `src/lib/api.ts` is still easy to own.

---

# 21. Technical-debt ownership in D2

## Direct D2 targets

### `NX-W1-D1-005`
API/error contract incomplete.

D2 should materially close the shared error-contract portion.

Do not mark the entire finding verified if W2 APIs are still absent.

### `NX-W1-D1-004`
Durable async handoff incomplete.

D2 only fixes architecture ownership needed for safe future implementation, such as generation reaching project through an application contract.

Do not implement queue/lease/reconciliation in D2.

### `NX-W1-D1-009`
Docs/route drift.

Re-evaluate against current FE. Update the finding based on current evidence.

## Explicitly not closed by D2

### `NX-W1-D1-001`
Fresh PostgreSQL boot/migration problem -> W1-D4.

### `NX-W1-D1-002`
Fail-open local auth/ownership -> W1-D5.

### `NX-W1-D1-003`
Visible flows mock-driven -> primarily W2-D1 through W2-D4.

### `NX-W1-D1-006`
H2 bypasses PostgreSQL migration -> W1-D4.

### `NX-W1-D1-007`
Full local runtime composition -> W1-D3.

### `NX-W1-D1-008`
FK/query indexing -> W1-D4 after query evidence.

---

# 22. Required verification

The agent must discover and use repository-native commands first.

## 22.1 Pre-change snapshot

Record:

```powershell
git status --short
git rev-parse HEAD
git branch --show-current
```

Preserve unrelated user changes.

## 22.2 Backend narrow checks

Examples:

```powershell
cd app/backend-service

# architecture/error contract tests
.\mvnw.cmd -Dtest=ArchitectureRulesTest test
.\mvnw.cmd -Dtest=ApiExceptionHandlerTest test

# complete backend tests
.\mvnw.cmd test
```

If the Windows wrapper still fails before Maven as recorded in W1-D1:

- record the exact failure;
- do not pretend it passed;
- use the verified installed `mvn` fallback only if repository policy permits;
- record both commands and results.

Do not silently patch the wrapper unless separately justified.

## 22.3 Frontend

```powershell
cd app/frontend-web

npm ci
npm run lint
npm run type-check
npm run build
```

There is currently no established frontend test runner in the baseline. Do not add a large test stack solely for D2 unless the change cannot be verified otherwise.

## 22.4 Static architecture searches

Run after implementation:

```powershell
rg -n "modules\.[^.]+\.api" app/backend-service/src/main/java/com/narrativex/backend/modules/*/application
rg -n "modules\.[^.]+\.repository" app/backend-service/src/main/java/com/narrativex/backend/modules
rg -n "org\.springframework\.web|redis|MinIO|software\.amazon|provider" app/backend-service/src/main/java/com/narrativex/backend/modules/*/domain
rg -n "fetch\(" app/frontend-web/src
rg -n "MOCK_|mock-data|assets-mock|presets-mock|production-mock" app/frontend-web/src
rg -n "useQuery|useMutation|QueryClient|QueryClientProvider" app/frontend-web/src
```

Interpret results; do not blindly make every match illegal.

## 22.5 Evidence

Create/update:

```text
documentation/audits/evidence/W1-D2_COMMAND_EVIDENCE.md
```

For each command record:

```text
Command:
Working directory:
Runtime/tool version:
Timestamp:
Exit code:
Result: PASS | FAIL | BLOCKED
First actionable error:
Predates W1-D2?: YES | NO | UNKNOWN
Notes:
```

Do not paste huge logs.

---

# 23. Definition of Done

W1-D2 is complete only when all applicable boxes are true.

## Source of truth

- [ ] Current frontend screens/routes/components are reflected accurately in FE docs.
- [ ] Assets/Presets classification reflects current rendered code.
- [ ] Frontend README framework version matches `package.json`.
- [ ] D1 findings changed only with new evidence.

## Backend architecture

- [ ] Architecture rules are automated.
- [ ] Application packages no longer import HTTP API DTOs.
- [ ] API packages do not call repositories directly.
- [ ] Generation no longer imports project repository directly.
- [ ] Domain packages have no provider/Redis/storage/web dependency violation.
- [ ] Shared does not depend on business modules.
- [ ] No empty future-module scaffolding was created.

## API contract

- [ ] ProblemDetail contract has stable machine-readable code.
- [ ] Validation includes structured violations.
- [ ] 404 is distinct from 400.
- [ ] optimistic/conflict path maps to 409.
- [ ] generic 500 is redacted.
- [ ] correlation ID is present.
- [ ] security error writers are reusable for W1-D5 if implemented.

## Transactions

- [ ] transactions remain at application boundaries.
- [ ] controllers do not own transactions.
- [ ] no external-provider call occurs in a DB transaction.
- [ ] no unnecessary persistence/schema rewrite occurred.

## Frontend

- [ ] existing UI design is visually unchanged.
- [ ] HTTP client owns base URL, credentials and ProblemDetail parsing.
- [ ] API DTO types are separated from presentation/mock models.
- [ ] QueryClientProvider foundation exists.
- [ ] server-state ownership rule is documented.
- [ ] Zustand remains UI/editor/mock state, not declared canonical server state.
- [ ] mock data mode is explicit and cannot silently masquerade as production persisted data.
- [ ] no provider token/secret is stored in browser state.

## Verification

- [ ] backend narrow tests pass or blockers are recorded.
- [ ] backend full tests pass or pre-existing blocker is recorded.
- [ ] `npm run lint` passes.
- [ ] `npm run type-check` passes.
- [ ] `npm run build` passes.
- [ ] W1-D2 evidence file records exact commands/results.
- [ ] no unrelated user work was overwritten.

---

# 24. Recommended implementation commits

If the coding workflow uses multiple commits, prefer small reviewable commits:

```text
docs: sync W1-D1 frontend baseline with current UI
test: add modular architecture dependency guards
refactor: remove api dto dependency from project application
refactor: route generation project access through project application
feat: standardize api problem details and correlation id
feat: establish frontend api and query foundation
chore: make frontend mock data mode explicit
docs: record W1-D2 verification and remaining debt
```

Do not commit/push automatically unless the user explicitly asked for publishing.

---

# 25. W1-D2 exit state

Expected architecture after D2:

```text
Frontend
  existing screens
  existing visual design
  |
  +-- UI/Zustand state
  |
  +-- AppProviders
       |
       +-- TanStack Query
       |
       +-- typed API client
             |
             +-- RFC9457 ApiProblem

Spring Boot
  |
  +-- module.api
  |     |
  |     v
  +-- module.application
  |     |
  |     +--> same-module domain/repository
  |     |
  |     +--> explicit application contract of another module
  |
  +-- module.domain
  |
  +-- shared.api / shared.security / shared.domain

Architecture tests enforce the arrows.
```

What should still be unfinished after a correct D2:

```text
PostgreSQL fresh migration gate      -> W1-D4
production authentication/ownership -> W1-D5
real project/story FE integration   -> W2-D1
asset upload                         -> W2-D2
durable queue/worker lease           -> W2-D3
SSE progress                         -> W2-D4
CI/staging                           -> W2-D5
real AI providers                    -> later phases
```

That unfinished work is expected. Do not pull it into W1-D2.
