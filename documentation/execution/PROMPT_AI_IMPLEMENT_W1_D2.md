# Prompt — AI Coding Agent implement NarrativeX W1-D2

You are the implementation agent for **NarrativeX W1-D2**.

Your job is to implement the repository plan in:

```text
documentation/plans/week-1/W1-D2_ARCHITECTURE_CLEANUP.md
```

If the user supplied an updated W1-D2 file, that supplied file replaces the older repository copy for this task. After implementation, synchronize the repository copy with the accepted plan.

Do not ask broad planning questions. Inspect the repository, preserve existing user work, implement the scoped plan, run the required checks, update evidence/docs, and report exact results.

---

## 1. Repository source of truth

Before changing code, read these files in this exact order:

```text
AGENTS.md
AI_CONTEXT.md
CONTRIBUTING.md

app/frontend-web/AGENTS.md

documentation/product/PRODUCT_SPEC.md
documentation/product/NARRATIVEX_WEEK_1_2_IMPLEMENTATION_TIMELINE.md

documentation/architecture/SYSTEM_ARCHITECTURE.md
documentation/architecture/SERVICE_BOUNDARIES.md
documentation/architecture/DATA_FLOW.md
documentation/architecture/TECHNOLOGY_STACK.md

documentation/domain/BUSINESS_RULES.md
documentation/domain/DOMAIN_MODEL.md
documentation/domain/GLOSSARY.md

documentation/plans/week-1/README.md
documentation/plans/week-1/W1-D1_REPOSITORY_AUDIT_UPDATED.md
documentation/plans/week-1/W1-D2_ARCHITECTURE_CLEANUP.md

documentation/audits/WEEK_1_TECHNICAL_DEBT.md
documentation/audits/WEEK_1_SECURITY_AUDIT.md
documentation/audits/WEEK_1_NO_REFACTOR.md

documentation/codebase/CODEBASE_MAP.md
documentation/codebase/BACKEND_CODEBASE.md
documentation/codebase/FRONTEND_CODEBASE.md
documentation/codebase/FRONTEND_API_INTEGRATION_MATRIX.md
documentation/codebase/AI_WORKER_CODEBASE.md
documentation/codebase/DATABASE_BASELINE.md
```

Then inspect the actual current code, especially:

```text
app/frontend-web/src/**
app/backend-service/src/**
app/backend-service/pom.xml
app/frontend-web/package.json
```

### Conflict rule

When sources conflict:

1. Product/domain/architecture invariants win.
2. Actual current code wins over stale audit text for factual current-state claims.
3. The existing frontend is the visual/design source of truth.
4. Update stale Markdown instead of modifying current FE to match old documentation.
5. Create an ADR before changing a cross-cutting architecture decision.

---

## 2. Mandatory Next.js rule

`app/frontend-web/AGENTS.md` is mandatory.

Before writing Next.js-specific code, read the relevant local framework documentation from:

```text
app/frontend-web/node_modules/next/dist/docs/
```

Do not assume older Next.js conventions from model memory.

The current frontend package manifest is authoritative for the installed versions.

---

## 3. Required skills/checklists

Use the available agent skills deliberately where applicable:

```text
architecture-patterns
architecture-decision-records
api-design-principles
spring-explore
spring-planning
spring-security-configuration
spring-data-jpa
error-handling-patterns
code-review-excellence
vercel-react-best-practices
run-tests
coverage
debugging-strategies
codefmt
```

Frontend/design skills may be used only to preserve existing UI quality and states. They are **not permission to redesign**:

```text
design-system
ui-styling
ui-ux-pro-max
design-taste-frontend
frontend-design
web-design-guidelines
```

---

## 4. Non-negotiable implementation constraints

Do NOT:

- redesign or restyle the existing UI;
- replace the current wizard/dashboard/production screens;
- introduce a new frontend framework;
- convert the whole app to a new routing model;
- implement W1-D3 Docker environment work;
- fix the W1-D4 PostgreSQL/Flyway baseline unless your D2 code caused a new regression;
- implement W1-D5 authentication/tenant ownership;
- wire the full W2 Project/Story flow;
- implement asset upload/storage;
- implement Redis queue/worker lease/SSE;
- integrate real AI/image/video/TTS providers;
- change the identifier strategy;
- introduce microservices;
- create empty future modules;
- put provider credentials in browser code;
- store authentication/provider tokens in Zustand/localStorage;
- make Redis canonical business state;
- overwrite unrelated user changes.

---

## 5. Start with repository safety

Run and record:

```powershell
git status --short
git rev-parse HEAD
git branch --show-current
```

Inspect existing modifications before editing.

Do not discard unrelated changes.

Do not commit or push unless the user explicitly requested publishing.

---

## 6. First implementation task: synchronize stale W1-D1 FE facts

Before architecture refactoring, compare W1-D1 docs to the current frontend.

Verify at minimum:

```text
app/frontend-web/src/app/page.tsx
app/frontend-web/src/features/**
app/frontend-web/src/store/**
app/frontend-web/src/lib/**
app/frontend-web/src/types/**
app/frontend-web/package.json
app/frontend-web/README.md
```

Known likely drift:

- current root page renders Asset Library;
- current root page renders Style Presets;
- old audit text may still classify those surfaces as dead/unrendered;
- README framework version may be stale;
- file/component names may have moved.

Update:

```text
documentation/codebase/FRONTEND_CODEBASE.md
documentation/codebase/FRONTEND_API_INTEGRATION_MATRIX.md
documentation/audits/WEEK_1_TECHNICAL_DEBT.md
```

Do not erase historical evidence. Add/update current evidence and status accurately.

---

## 7. Backend architecture implementation

### 7.1 Add automated architecture tests

Create tests under:

```text
app/backend-service/src/test/java/com/narrativex/backend/architecture/
```

Use ArchUnit or an equivalent package-level tool.

If adding a dependency, verify compatibility with Java 25. Do not invent a version from memory.

Enforce:

```text
application !-> api
api !-> repository
module A !-> module B.repository
domain !-> Spring Web / Redis / object storage / provider SDK / worker runtime
shared !-> business modules
REST controllers belong in api packages
```

Do not force a JPA persistence rewrite in D2. `jakarta.persistence` in current domain entities is not the target of this day.

Prove the rules detect current violations, then fix the violations and make tests green.

---

## 8. Remove current dependency-direction violations

### 8.1 Project application must not import HTTP DTOs

Current application code imports API request types.

Replace that dependency with minimal application commands, for example:

```text
CreateProjectCommand
CreateStoryVersionCommand
```

Controller maps request DTO -> application command.

Do not introduce MapStruct or a mapper framework for trivial mappings.

### 8.2 Generation must not reach ProjectRepository

Current generation application reaches into project persistence.

Replace this with the smallest explicit application-facing project contract, for example:

```text
ProjectAccess
ProjectQueryService
```

Generation may depend on the project application contract, not the project repository.

Do not create generic repository registries or new event infrastructure for this lookup.

---

## 9. Standardize the HTTP error boundary

Implement RFC 9457 ProblemDetail with stable fields.

Minimum fields:

```text
status
detail
code
messageKey
path
correlationId
```

Validation additionally exposes structured field violations.

Initial stable codes:

```text
INVALID_REQUEST
VALIDATION_FAILED
RESOURCE_NOT_FOUND
RESOURCE_CONFLICT
ACCESS_DENIED
UNAUTHENTICATED
INTERNAL_ERROR
```

Only add codes that current behavior can support.

Map at minimum:

```text
400 validation/business-invalid
404 resource not found
409 optimistic/resource conflict
403 access denied
401 unauthenticated
500 unexpected error, redacted
```

Security enforcement remains W1-D5. You may create reusable 401/403 ProblemDetail handlers without redesigning auth.

Never expose:

```text
stack trace
SQL
exception class
provider payload
token
credential
raw sensitive prompt/story
```

Add a minimal correlation ID request boundary and include the ID in both response header and error payload.

---

## 10. Preserve transaction ownership

Review current application services.

Keep:

```text
@Transactional
@Transactional(readOnly = true)
```

at application use-case boundaries.

Do not move transactions into controllers.

Do not perform external provider calls inside transactions.

Do not perform a database/schema refactor for D2.

Translate optimistic/resource conflicts to stable HTTP 409 where applicable.

---

## 11. Backend tests

Add narrow deterministic coverage for changed behavior.

At minimum cover:

```text
architecture dependency rules
validation -> 400 + VALIDATION_FAILED
not found -> 404 + RESOURCE_NOT_FOUND
conflict -> 409 + RESOURCE_CONFLICT
generic failure -> redacted 500
correlationId present
project create/story success still works
generation uses project application boundary, not project repository
```

Prefer small Spring test slices over full context when possible.

Do not make D2 depend on the W1-D4 fresh PostgreSQL migration fix.

---

## 12. Frontend API foundation — preserve all visuals

Do not redesign any screen.

### 12.1 Upgrade `src/lib/api.ts`

Keep one HTTP owner.

Centralize:

```text
NEXT_PUBLIC_API_BASE_URL
credentials: include
Accept headers
JSON body content type
ProblemDetail parsing
safe non-JSON fallback
ApiClientError
```

Add typed `ApiProblem` and field violation types.

`ApiClientError` should expose:

```text
status
code
messageKey
correlationId
problem
```

Do not add axios.

### 12.2 Separate API DTO types from UI/mock types

Create a clear API DTO boundary, e.g.:

```text
src/types/api.ts
```

Do not force backend DTOs to equal the current presentation model.

Preserve current UI mock/string IDs until each W2 feature is actually integrated.

### 12.3 Establish TanStack Query provider

TanStack Query is already installed.

Add a minimal provider/client foundation, for example:

```text
src/app/providers.tsx
src/lib/query-client.ts
src/lib/query-keys.ts
```

Wire the provider through the current root layout.

Use conservative retry behavior. Do not retry normal 4xx failures.

Do not wire every screen in D2.

### 12.4 State ownership

After D2:

```text
TanStack Query = backend/server state
Zustand        = UI/editor/transient state
```

Do not migrate all current mock stores now.

Do not declare Zustand as canonical for persisted projects/assets/jobs/entitlements/auth.

---

## 13. Make mock mode explicit

Introduce one small environment-aware data-mode contract, e.g.:

```text
NEXT_PUBLIC_NX_DATA_MODE=mock|api
```

Policy:

```text
local development:
  mock may be explicitly enabled

staging/production:
  default api
  never silently fallback to mock
```

Keep `npm run build` green.

Production must not silently display fake local projects/jobs/assets as if they were authoritative server data.

Document the flag in:

```text
app/frontend-web/.env.example
app/frontend-web/README.md
```

Do not expose any secret through `NEXT_PUBLIC_*`.

---

## 14. Do not pull Week 2 implementation into D2

Do not fully connect visible flows to backend yet.

Leave these for their mapped milestones:

```text
Dashboard project query/create -> W2-D1
Story read/update              -> W2-D1
Upload                         -> W2-D2
Queue/worker lease             -> W2-D3
Job SSE/progress               -> W2-D4
CI/staging                     -> W2-D5
```

D2 builds the safe boundaries they will use.

---

## 15. Documentation updates

Update the smallest relevant files:

```text
documentation/plans/week-1/W1-D2_ARCHITECTURE_CLEANUP.md
documentation/architecture/SERVICE_BOUNDARIES.md
documentation/codebase/BACKEND_CODEBASE.md
documentation/codebase/FRONTEND_CODEBASE.md
documentation/codebase/FRONTEND_API_INTEGRATION_MATRIX.md
documentation/audits/WEEK_1_TECHNICAL_DEBT.md
app/frontend-web/README.md
```

Create:

```text
documentation/audits/evidence/W1-D2_COMMAND_EVIDENCE.md
```

Do not update unrelated documents.

Create an ADR only if you actually change a cross-cutting architectural decision.

---

## 16. Verification

Run narrow checks after each task.

Then run supported full checks.

### Backend

```powershell
cd app/backend-service
.\mvnw.cmd test
```

If the wrapper still fails before Maven as documented in W1-D1:

- record the failure exactly;
- use installed `mvn test` only as a documented fallback;
- do not falsely report wrapper success.

### Frontend

```powershell
cd app/frontend-web
npm ci
npm run lint
npm run type-check
npm run build
```

### Static checks

```powershell
rg -n "modules\.[^.]+\.api" app/backend-service/src/main/java/com/narrativex/backend/modules/*/application
rg -n "modules\.[^.]+\.repository" app/backend-service/src/main/java/com/narrativex/backend/modules
rg -n "org\.springframework\.web|redis|MinIO|software\.amazon" app/backend-service/src/main/java/com/narrativex/backend/modules/*/domain
rg -n "fetch\(" app/frontend-web/src
rg -n "MOCK_|mock-data|assets-mock|presets-mock|production-mock" app/frontend-web/src
rg -n "useQuery|useMutation|QueryClient|QueryClientProvider" app/frontend-web/src
```

Interpret matches; do not blindly "fix" valid matches.

---

## 17. Evidence format

For every important verification command, record:

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

Never claim a test passed unless you ran it.

Do not paste massive logs into Markdown.

---

## 18. Completion gate

Do not mark W1-D2 complete until:

```text
[ ] FE docs match current rendered code
[ ] application -> api violation removed
[ ] generation -> project.repository violation removed
[ ] backend architecture rules are automated
[ ] stable ProblemDetail contract exists
[ ] validation/not-found/conflict/500 paths tested
[ ] correlationId exists
[ ] transactions remain application-owned
[ ] existing UI design is unchanged
[ ] frontend typed ApiProblem/client exists
[ ] QueryClientProvider foundation exists
[ ] API DTO types are separated from presentation types
[ ] mock mode is explicit and environment-aware
[ ] frontend lint passes
[ ] frontend type-check passes
[ ] frontend build passes
[ ] backend tests pass or pre-existing blockers are explicitly recorded
[ ] W1-D2 evidence is updated
[ ] unrelated user changes were preserved
```

---

## 19. Final response format

When finished, report:

### Implemented

- exact architecture changes;
- exact API/error changes;
- exact frontend foundation changes;
- documentation updated.

### Files changed

Group by:

```text
backend
frontend
documentation
tests
```

### Verification

For every command:

```text
command -> PASS/FAIL/BLOCKED
```

Include the first actionable error for failures.

### Source-of-truth corrections

State any W1-D1 documentation that was stale and how it was corrected.

### Remaining work

List only the correctly deferred items:

```text
W1-D3
W1-D4
W1-D5
W2-D1+
```

### Safety

Confirm:

```text
no UI redesign
no provider integration
no secret added
no unrelated work overwritten
no commit/push unless requested
```

If part of the plan cannot be completed, finish everything else that is safe, record the blocker with evidence, and do not invent success.
