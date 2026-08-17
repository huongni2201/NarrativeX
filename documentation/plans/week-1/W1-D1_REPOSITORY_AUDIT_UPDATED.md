# W1-D1 — Repository Audit, Integration Baseline & Agent Skill Plan

## Objective

Produce reproducible evidence of what exists, what is mocked, what is unsafe, what is ready to integrate, and what must remain untouched before NarrativeX moves into Week 1 Day 2 and the Week 2 API-integration work.

**W1-D1 is audit/diagnostic only. Do not refactor production code, redesign UI, replace framework choices, or integrate real AI providers on this day.**

The frontend UI is already implemented. Frontend work in D1 is therefore limited to:

- mapping existing screens/components to real backend contracts;
- identifying mock/static/local-only data paths;
- verifying the existing API client, state ownership and error/loading behavior;
- producing an integration matrix for later API wiring;
- identifying missing backend endpoints required by the existing UI.

## Current starting point

Treat the following as **initial hypotheses that must be verified with repository evidence**, not as unquestioned facts:

- Backend: Spring Boot 4.1/Java 25 with JPA, Flyway V1–V3, Redis, Actuator and initial `project`, `storyboard`, `generation`, `health` modules.
- Security: conditional OIDC exists, but local mode permits every `/api/v1/**` route; project ownership currently depends on a local user ID scaffold.
- Frontend: Next.js 16/React 19 studio UI, typed API client, Zustand/TanStack Query dependencies and several mock-data paths.
- Worker: Python 3.12 typed provider boundary and dry-run lifecycle; no durable claim/lease/queue execution.
- Infrastructure: Compose has PostgreSQL 16, Redis 7 and MinIO; application containers and complete environment templates are not yet proven.

---

## 1. Mandatory skill usage for the AI coding agent

The agent must deliberately apply the following available skills where relevant. Skills are guidance/checklists, not permission to rewrite unrelated code.

| Area | Required / Preferred skills | How to use in W1-D1 |
|---|---|---|
| Architecture | `architecture-patterns`, `architecture-decision-records` | Validate modular-monolith boundaries, dependency direction and identify decisions that need ADRs later. Do not perform extraction/refactor in D1. |
| API | `api-design-principles` | Inventory current endpoints, request/response contracts, error formats, versioning and missing APIs required by the existing FE. |
| Java / Spring | `spring-explore`, `spring-planning` | Inspect Spring modules, configuration, controller/service/repository boundaries, transactions and framework usage. |
| Spring Security | `spring-security-configuration` | Audit OIDC/JWT/local mode, route protection, ownership enforcement, actuator exposure and insecure `permitAll`. |
| Database | `postgresql-table-design` | Review tables, keys, indexes, constraints, tenant/workspace scope and schema ownership. |
| SQL | `sql-optimization-patterns` | Flag obviously missing indexes or query risks only where evidence exists; do not prematurely tune. |
| Python worker | `async-python-patterns`, `python-background-jobs` | Inspect current worker lifecycle and identify gaps for durable queue/lease/recovery. Do not implement queue yet. |
| Python tests | `python-testing-patterns` | Verify test layout, fixtures and baseline coverage for worker behavior. |
| Testing | `run-tests`, `coverage` | Execute reproducible baseline commands and record pass/fail/coverage if configured. |
| Debugging | `debugging-strategies` | Use only for failing baseline commands; record root cause evidence rather than ad-hoc fixes. |
| Code quality | `code-review-excellence`, `error-handling-patterns` | Review code paths for unsafe behavior, inconsistent error contracts, swallowed failures and technical debt. |
| Frontend integration | `vercel-react-best-practices` | Inspect current React/Next.js data flow, unnecessary client fetching, hydration/client-state issues and API wiring risks. Do not redesign UI. |
| Frontend/UI | `web-design-guidelines`, `design-system`, `ui-styling`, `ui-ux-pro-max`, `design-taste-frontend`, `frontend-design` | **Audit only** whether existing UI states can represent loading/error/empty/progress/disabled/permission states. Do not create a new visual design. |
| Formatting | `codefmt` | Use only on diagnostic/supporting code touched by D1. |
| Skill discovery | `find-skills` | Use only if a gap is found that no listed skill covers. |

### Skill guardrail

The agent must not use frontend/design skills as justification to rebuild or restyle the existing UI. In W1-D1 the frontend is treated as an existing product surface to be integrated, not redesigned.

---

## 2. Deliverables

Create or update:

- `documentation/codebase/CODEBASE_MAP.md` — current vs target repository/runtime map.
- `documentation/codebase/BACKEND_CODEBASE.md` — module inventory, endpoint inventory, persistence, transactions, error handling and security gaps.
- `documentation/codebase/FRONTEND_CODEBASE.md` — current routes/screens/components, real API calls, mock/static/local sources, client-state ownership and integration readiness.
- `documentation/codebase/FRONTEND_API_INTEGRATION_MATRIX.md` — **mandatory because UI already exists**; maps each existing screen/action to required backend API and current implementation state.
- `documentation/codebase/AI_WORKER_CODEBASE.md` — implemented worker contracts/runtime vs Week 2 target.
- `documentation/codebase/DATABASE_BASELINE.md` — Flyway/JPA/table/index/constraint/tenant-scope matrix.
- `documentation/audits/WEEK_1_BASELINE.md` — commands, working directory, versions, exit codes, result summary and timestamp.
- `documentation/audits/WEEK_1_TECHNICAL_DEBT.md` — P0/P1/P2 register using the required finding schema below.
- `documentation/audits/WEEK_1_SECURITY_AUDIT.md` — auth/config/secret/tenant-boundary findings.
- `documentation/audits/WEEK_1_NO_REFACTOR.md` — explicitly deferred areas.
- `documentation/audits/evidence/` — concise, secret-free evidence only when it adds diagnostic value.

---

## 3. Required output schemas

### 3.1 Finding schema

Every P0/P1/P2 finding must use this structure:

```text
ID: NX-W1-D1-XXX
Severity: P0 | P1 | P2
Component: backend | frontend | worker | database | infrastructure | security
Title:
Evidence:
File/line or command:
Current behavior:
Expected behavior:
Impact:
Risk type: security | data | cost | reliability | maintainability | integration
Recommended owner:
Target milestone: W1-D2 | W1-D3 | W1-D4 | W1-D5 | W2-D1...
Dependencies:
Closure test:
Status: OPEN | BLOCKED | VERIFIED
```

No finding may be created from assumption alone. It must include repository or runtime evidence.

### 3.2 Baseline command schema

Every executed verification command must record:

```text
Command:
Working directory:
Runtime/tool version:
Environment/profile:
Timestamp:
Exit code:
Result: PASS | FAIL | BLOCKED
First actionable error:
Predates W1-D1?: YES | NO | UNKNOWN
Evidence path (optional):
Notes:
```

Do not paste megabytes of logs into documentation.

### 3.3 Frontend integration row schema

`FRONTEND_API_INTEGRATION_MATRIX.md` must contain at least:

| Screen/Feature | Route | UI Action | Current Data Source | State | Existing Client Function | Required Backend API | Auth/Workspace Scope | Missing FE Wiring | Missing BE Contract | Week Target |
|---|---|---|---|---|---|---|---|---|---|---|

Allowed state values:

- `REAL` — connected to real backend and persisted correctly.
- `PARTIAL` — some real integration exists but behavior is incomplete.
- `MOCK` — UI exists but data/action is mocked/static/local only.
- `DEAD` — UI/action exists but is unused or unreachable.
- `UNKNOWN` — cannot be proven yet; must include reason.

Because FE is already implemented, **do not create replacement screens/components during D1**.

### 3.4 Database baseline schema

`DATABASE_BASELINE.md` must include:

| Entity | Table | Migration owner | PK type | FK / delete rule | Important indexes | Workspace/Tenant scope | JPA match | Gap/Risk |
|---|---|---|---|---|---|---|---|---|

---

## 4. Audit procedure

### 4.1 Inventory build and runtime boundaries

Apply: `architecture-patterns`, `spring-explore`, `async-python-patterns`, `python-background-jobs`, `code-review-excellence`.

- [ ] Record Java, Maven/Gradle, Node/npm/pnpm, Python, Docker and Compose versions actually used by the repo.
- [ ] Inventory module manifests (`pom.xml`, `package.json`, `pyproject.toml`, lockfiles) and flag unused, duplicate, vulnerable or unpinned dependencies **only when evidence is available**.
- [ ] Map runtime processes and communication paths: FE → BE → PostgreSQL/Redis/MinIO; worker → provider boundary; health endpoints.
- [ ] Verify whether backend is the only Flyway/schema owner.
- [ ] Verify worker does not perform unauthorized canonical business-state writes directly to PostgreSQL.
- [ ] Verify where business state, cache, progress and binary assets are actually stored today.
- [ ] Identify duplicated responsibility between backend and worker.

### 4.2 Configuration and secret exposure

Apply: `spring-security-configuration`, `error-handling-patterns`, `code-review-excellence`.

- [ ] Inventory configuration keys without printing secret values.
- [ ] Search committed files for provider keys, DB passwords, MinIO/S3 credentials, JWT/OIDC secrets and `.env` files.
- [ ] Audit `NEXT_PUBLIC_*` usage and confirm only intentionally public values are exposed to browser bundles.
- [ ] Verify `.gitignore` coverage for secrets, local envs and generated evidence.
- [ ] Record CORS configuration by environment.
- [ ] Record CSRF assumptions if cookie/session auth exists.
- [ ] Record OIDC/JWT issuer/audience/claim mapping if applicable.
- [ ] Check actuator endpoint exposure and whether sensitive management endpoints are externally accessible.
- [ ] Inspect Docker/Compose published ports and default credentials.
- [ ] Inspect logs for accidental token/story/prompt/secret leakage.

Never copy secret values into audit documents.

Useful searches:

```powershell
rg -n "mock|TODO|FIXME|permitAll|local-user|NEXT_PUBLIC|api[_-]?key|secret|password|token" app documentation .github
rg -n "@(Get|Post|Put|Patch|Delete)Mapping|RequestMapping" app/backend-service/src
rg -n "fetch\(|api\.|useQuery|useMutation|zustand|create\(" app/frontend-web/src
rg -n "ddl-auto|Flyway|spring\.datasource|redis|minio|s3|oidc|jwt|cors|actuator" app
```

### 4.3 Backend API and module audit

Apply: `api-design-principles`, `spring-explore`, `spring-planning`, `architecture-patterns`, `error-handling-patterns`.

- [ ] Inventory every backend controller route.
- [ ] Record HTTP method/path, request DTO, response DTO, validation, authentication, workspace ownership, persistence and transaction behavior.
- [ ] Identify inconsistent response/error contracts.
- [ ] Identify endpoints that trust user/workspace/project IDs without server-side ownership validation.
- [ ] Identify domain modules importing provider SDKs or infrastructure concerns.
- [ ] Record current transaction boundaries for write operations.
- [ ] Map existing `/api/v1` routes to UI requirements.
- [ ] Produce list of missing APIs required to connect the already-built frontend.

Backend endpoint table should contain:

| Method | Path | Controller | Auth | Workspace scoped | Request | Response | Persistence | Transaction | Used by FE | Risk/Gap |
|---|---|---|---|---|---|---|---|---|---|---|

### 4.4 Frontend integration audit — no UI rebuild

Apply: `vercel-react-best-practices` and frontend/design skills **for audit only**.

- [ ] Enumerate all current user-visible routes/screens relevant to Week 1–2.
- [ ] Trace each screen/action to existing API client, TanStack Query hook, Zustand store, localStorage, static data or mock service.
- [ ] Identify all direct `fetch()`/axios calls outside the established API layer.
- [ ] Identify duplicated server state held in Zustand/local component state that should later come from API cache.
- [ ] Verify existing UI has states for `loading`, `empty`, `error`, `forbidden`, `saving`, `saved`, `conflict`, `uploading`, `processing` where applicable.
- [ ] Identify controls that currently succeed visually without backend persistence.
- [ ] Identify exact backend API contracts needed to replace every `MOCK` or `PARTIAL` flow.
- [ ] Confirm existing UI can be wired without visual redesign. If not, record only the smallest integration gap; do not implement it on D1.

Priority Week 2 flows to map:

```text
Dashboard
→ Create Project
→ Open Project
→ Edit/Save Story
→ Reload persisted Story
→ Upload reference asset
→ Start fake generation job
→ Observe progress
```

### 4.5 Migration and database/domain baseline

Apply: `postgresql-table-design`, `sql-optimization-patterns`, `spring-data-jpa` if available, `spring-explore`.

- [ ] List every Flyway migration and tables/indexes/constraints it owns.
- [ ] Compare JPA entities to PostgreSQL schema using `ddl-auto=validate` or equivalent validation, not only an in-memory database.
- [ ] Record current PK strategy and inconsistencies (`BIGINT`, UUID, string IDs).
- [ ] Record missing FK indexes.
- [ ] Record missing unique/check constraints.
- [ ] Record delete actions/cascade behavior.
- [ ] Record nullable columns that contradict domain requirements.
- [ ] Record tenant/workspace-scoping constraints and risks of cross-tenant access.
- [ ] Record tables from the target domain model that are absent, partial or prematurely introduced.
- [ ] Do **not** create Week 2/3 schema in D1.

### 4.6 Worker baseline

Apply: `async-python-patterns`, `python-background-jobs`, `python-testing-patterns`, `error-handling-patterns`.

Classify worker capabilities as:

- `PORT_ONLY`
- `DETERMINISTIC_FAKE`
- `INTEGRATED`
- `UNIMPLEMENTED`

Audit:

- [ ] job intake mechanism;
- [ ] provider interface boundaries;
- [ ] retry behavior;
- [ ] exception hierarchy;
- [ ] idempotency support;
- [ ] lease/claim ownership;
- [ ] worker shutdown behavior;
- [ ] durable recovery behavior;
- [ ] provider status polling/reconciliation hooks;
- [ ] logging/correlation fields;
- [ ] current tests.

Explicitly confirm that fake/dry-run provider health is not presented as production provider health.

### 4.7 Verification baseline

Apply: `run-tests`, `coverage`, `python-testing-patterns`, `debugging-strategies`.

The agent must discover repository-supported commands first (wrappers/scripts/Makefile/package scripts). Prefer repository-native commands over inventing new ones.

At minimum run, if supported:

**Backend**

```text
compile/build
unit tests
integration tests
Spring context startup
Flyway/schema validation against PostgreSQL
```

**Worker**

```text
pytest
ruff
mypy --strict (if configured)
```

**Frontend**

```text
install using existing lockfile/package manager
lint
typecheck
tests if configured
production build
```

**Infrastructure**

```text
docker compose config
docker compose up dependencies
health/status checks
```

For every failure:

- [ ] record exact command and exit code;
- [ ] record first actionable error;
- [ ] identify likely component owner;
- [ ] identify whether failure clearly predates D1;
- [ ] do not silently patch production code just to make baseline green.

### 4.8 Security/tenant-boundary smoke checks

Apply: `spring-security-configuration`, `code-review-excellence`.

Audit/verify where possible:

```text
Anonymous → protected route
Invalid token → protected route
User A → Project A
User A → Project B
Local mode → /api/v1/**
Actuator exposure
CORS origin behavior
```

If the current product does not yet support the full user/workspace setup, document the missing precondition instead of fabricating a passing result.

---

## 5. Technical-debt severity

| Severity | Meaning | Examples for this repository |
|---|---|---|
| P0 | Blocks secure Week 2 work or risks data/cost exposure | non-local `permitAll`, committed secret, browser-exposed private key, migration cannot build empty DB, cross-tenant read/write, unsafe provider retry that can double-charge |
| P1 | Must close before Week 3 AI integration | unstable API errors, missing ownership scope, Redis-only business state, provider SDK in backend domain, no deterministic integration path, worker without safe recovery foundation |
| P2 | Valuable but safe to defer | naming cleanup, UI component consolidation, speculative performance tuning, non-blocking stylistic cleanup |

Each item must include the Finding Schema from Section 3.1.

---

## 6. No-refactor boundary

Unless a P0 finding proves a minimal emergency fix is required, defer:

- UI rewrite, visual redesign or design-system replacement.
- Replacing the existing frontend framework/state stack.
- Broad frontend component cleanup unrelated to API integration.
- Microservice extraction.
- Real AI/image/video/TTS providers.
- FFmpeg/media pipeline implementation.
- Full generation/render/shorts schema.
- Broad renaming of domain types or routes.
- Kafka/Kubernetes/event-sourcing introduction.
- Major framework upgrades.
- Premature shared abstractions across frontend feature slices.

If a P0 requires a production-code change, stop and record a separate remediation task; do not bundle the fix into the audit without explicit task scope.

---

## 7. D1 completion gate

The agent may report **COMPLETE** only when all of the following are satisfied:

- [ ] All runtime components and infrastructure dependencies appear in the architecture/runtime map.
- [ ] All initial starting-point claims were verified, corrected or marked unverified with evidence.
- [ ] Every current backend API is inventoried with auth/workspace/persistence status.
- [ ] Every visible Week 1–2 frontend flow is classified as `REAL`, `PARTIAL`, `MOCK`, `DEAD` or `UNKNOWN`.
- [ ] `FRONTEND_API_INTEGRATION_MATRIX.md` identifies the exact APIs needed to wire the existing UI.
- [ ] No new UI design or replacement screen was introduced.
- [ ] Every current Flyway migration has an owner and DB baseline row.
- [ ] JPA/schema mismatches are documented.
- [ ] Worker capabilities and missing durable execution primitives are classified.
- [ ] P0/P1/P2 register contains reproducible evidence, owner, milestone and closure test.
- [ ] Security audit covers secrets, local `permitAll`, tenant/workspace ownership, CORS and actuator exposure.
- [ ] Baseline commands include working directory, version/environment, exit code and result.
- [ ] No production source code was refactored as part of the audit.

### Completion status rules

Use exactly one:

- `COMPLETE` — all mandatory evidence/deliverables are present.
- `PARTIAL` — audit ran but one or more mandatory checks could not be completed; blockers are listed.
- `BLOCKED` — environment/repository state prevents meaningful audit; blocker and recovery action are listed.

The agent must not report `COMPLETE` because "most checks passed".

---

## 8. Required final D1 summary

At the end of W1-D1, the agent must produce this concise summary:

```text
W1-D1 STATUS: COMPLETE | PARTIAL | BLOCKED

BASELINE
Backend: PASS/FAIL/BLOCKED
Frontend: PASS/FAIL/BLOCKED
Worker: PASS/FAIL/BLOCKED
Infrastructure: PASS/FAIL/BLOCKED

TOP RISKS
P0: <count>
P1: <count>
P2: <count>

FRONTEND INTEGRATION
REAL: <count>
PARTIAL: <count>
MOCK: <count>
DEAD: <count>
UNKNOWN: <count>

W1-D2 INPUT
- architecture issues to fix
- API/error conventions to normalize
- frontend APIs that must be preserved

W1-D3 INPUT
- Docker/environment gaps

W1-D4 INPUT
- migration/schema/identifier/index gaps

W1-D5 INPUT
- auth/ownership/security gaps

W2 INPUT
- exact existing UI actions to connect to backend
- exact missing backend API contracts
```

---

## 9. D1 agent execution prompt

Use the following prompt when assigning the full D1 audit to a coding agent:

```text
TASK: NX-W1-D1 — Repository Audit, Integration Baseline & Skill-Guided Assessment

NarrativeX already has a frontend UI. Do not redesign or rebuild it.
Your job is to audit the repository and produce evidence that prepares the backend/worker/infrastructure for integration with the existing UI.

MANDATORY RULES
1. Do not refactor production source code.
2. Do not perform framework major upgrades.
3. Do not add real AI/image/video/TTS providers.
4. Do not replace frontend architecture or visual design.
5. Treat initial architecture statements as hypotheses; verify them.
6. Every finding needs reproducible evidence.
7. Do not expose or copy secret values into docs/logs.
8. Use repository-native build/test commands.
9. PostgreSQL must be assessed as canonical business state; Redis is not assumed canonical.
10. Produce a precise frontend-to-backend integration matrix because the UI already exists.

APPLY AVAILABLE SKILLS
- architecture-patterns
- architecture-decision-records
- api-design-principles
- spring-explore
- spring-planning
- spring-security-configuration
- postgresql-table-design
- sql-optimization-patterns
- async-python-patterns
- python-background-jobs
- python-testing-patterns
- run-tests
- coverage
- debugging-strategies
- code-review-excellence
- error-handling-patterns
- vercel-react-best-practices
- web-design-guidelines/design-system/ui skills for AUDIT ONLY, not redesign
- codefmt only for diagnostic/support files touched by this task
- find-skills only if an uncovered gap requires it

DELIVERABLES
Create/update all files specified in W1-D1_REPOSITORY_AUDIT_UPDATED.md.

FRONTEND-SPECIFIC REQUIREMENT
For every existing Week 1–2 screen/action, identify:
- route/screen/component
- current data source
- current REAL/PARTIAL/MOCK/DEAD/UNKNOWN state
- existing API client/hook/store
- required backend endpoint
- request/response contract if inferable from code
- auth/workspace ownership requirement
- missing frontend wiring
- missing backend implementation
- target week/day

DO NOT IMPLEMENT THE MISSING API OR UI WIRING IN D1.

FINAL RESPONSE
Report only COMPLETE, PARTIAL or BLOCKED using the mandatory D1 final summary format, followed by the paths of the generated audit documents and the highest-risk findings.
```
