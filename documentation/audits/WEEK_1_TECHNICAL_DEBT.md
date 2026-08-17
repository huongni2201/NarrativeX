# NarrativeX Week 1 Technical Debt Register

Status: OPEN findings from W1-D1 repository audit  
Audit date: 2026-08-17  
Source of truth: `documentation/plans/week-1/W1-D1_REPOSITORY_AUDIT_UPDATED.md`

This register records evidence-backed gaps found during the audit. It does not authorize production refactoring. Each item has an owner, milestone, and closure test so implementation can be planned separately.

## Summary

| ID | Severity | Component | Title | Blocks next phase | Status |
|---|---|---|---|---|---|
| NX-W1-D1-001 | P0 | database/backend | Fresh PostgreSQL cannot boot the backend | YES | OPEN |
| NX-W1-D1-002 | P0 | security/backend | Local authentication and API authorization fail open | YES | OPEN |
| NX-W1-D1-003 | P1 | frontend | Visible studio flows are mock/local-state driven | NO | OPEN |
| NX-W1-D1-004 | P1 | backend/worker | Durable async operation handoff is incomplete | YES | OPEN |
| NX-W1-D1-005 | P1 | backend/frontend | API and error contracts are incomplete for the target flows | NO | PARTIAL — W1-D2 shared error/client boundary closed; Week 2 resource contracts remain |
| NX-W1-D1-006 | P1 | database/backend | H2 test profile bypasses PostgreSQL migrations | YES | OPEN |
| NX-W1-D1-007 | P1 | infrastructure/security | Local infrastructure has exposed defaults and no app runtime composition | NO | OPEN |
| NX-W1-D1-008 | P2 | database | Foreign-key access paths are not explicitly indexed | NO | OPEN |
| NX-W1-D1-009 | P2 | frontend/docs | Documentation and route surface have drift/dead entries | NO | VERIFIED for W1-D2 baseline; notification/settings remain planned/no-op |

## Findings

### NX-W1-D1-001

Severity: P0  
Component: database/backend  
Title: Fresh PostgreSQL cannot boot the backend  
Evidence: The backend is configured with Flyway and Hibernate validation, but a fresh Compose PostgreSQL instance had no migration history or application tables. Starting Spring Boot failed with `Schema-validation: missing table [chapters]`; `psql` confirmed `flyway_schema_history` did not exist.  
File/line or command: `app/backend-service/src/main/resources/application.yml:9-27`; `app/backend-service/src/main/resources/db/migration/V1__schema_baseline.sql`; `V2__create_core_schema.sql`; `V3__add_rights_and_control_plane.sql`; commands in `documentation/audits/evidence/W1-D1_COMMAND_EVIDENCE.md`.  
Current behavior: Hibernate validates against an empty PostgreSQL schema before the service becomes usable.  
Expected behavior: Flyway applies V1-V3 to an empty supported PostgreSQL database before Hibernate validation, and startup succeeds with a recorded migration history.  
Impact: A clean environment cannot start the backend or execute the first database-backed flow.  
Risk type: reliability, deployment, data integrity  
Recommended owner: backend/platform  
Target milestone: W1-D4  
Dependencies: Confirm Flyway configuration/order and use an isolated PostgreSQL integration test.  
Closure test: Start an empty PostgreSQL 16 instance, boot the backend, assert migration history contains V1-V3, and exercise a project read/write.  
Blocks next phase: YES  
Status: OPEN

### NX-W1-D1-002

Severity: P0  
Component: security/backend  
Title: Local authentication and API authorization fail open  
Evidence: The local security chain permits all `/api/v1/**` and all other requests. `CurrentUserId` accepts an arbitrary `X-User-Id` header when OIDC is disabled, and OIDC is disabled by default.  
File/line or command: `app/backend-service/src/main/java/com/narrativex/backend/config/SecurityConfig.java:37-48`; `CurrentUserId.java:24-27`; `application.yml:37-39`.  
Current behavior: Requests can select the effective user identity with a header in the default local profile; API authorization is not enforced.  
Expected behavior: Local bypass is explicit and isolated to a development-only profile; non-local requests fail closed and identity comes only from a verified server-side principal.  
Impact: Cross-tenant reads/writes and unauthenticated API use are possible if the default configuration is exposed.  
Risk type: authentication, authorization, tenant isolation  
Recommended owner: backend/security  
Target milestone: W1-D5  
Dependencies: Define local developer identity semantics and the OIDC issuer/client configuration contract.  
Closure test: Anonymous, invalid-token, and forged-header tests fail; an authenticated principal can access only owned resources; local bypass is unavailable in the production profile.  
Blocks next phase: YES  
Status: OPEN

### NX-W1-D1-003

Severity: P1  
Component: frontend  
Title: Visible studio flows are mock/local-state driven  
Evidence: The visible page renders store-backed mock projects/characters; the wizard creates local IDs and fake counts; analysis progress is a timer; production screens mutate local mock data. The only project API caller is `StudioDashboard`, which is not rendered by the page route.  
File/line or command: `app/frontend-web/src/store/useStudioStore.ts:55-160`; `useProductionStore.ts:37-153`; `features/project-creation/Step3AnalysisProgress.tsx`; `features/project-creation/Step4AnalysisComplete.tsx`; `src/app/page.tsx`; `src/features/dashboard/StudioDashboard.tsx`.  
Current behavior: Refreshing or changing users does not reflect backend project, story, job, or analysis state.  
Expected behavior: Targeted screens use the versioned API client and durable server state, with explicit loading/error/reload behavior.  
Impact: The apparent end-to-end product path is not connected to the authoritative backend.  
Risk type: correctness, integration, product readiness  
Recommended owner: frontend with backend  
Target milestone: W2-D1 through W2-D4  
Dependencies: Close API/error contract and async operation semantics first.  
Closure test: Create/import/reload/analyze flows pass through the API against PostgreSQL and a browser refresh preserves server state.  
Blocks next phase: NO  
Status: OPEN

### NX-W1-D1-004

Severity: P1  
Component: backend/worker  
Title: Durable async operation handoff is incomplete  
Evidence: Enqueue creates an `OperationPlan` with zeroed estimates and a `GenerationJob`, but no reservation, idempotency key, queue publication, worker claim, lease, heartbeat, or reconciliation path exists. The worker is an idle loop with a disabled provider.  
File/line or command: `modules/generation/application/usecase/EnqueueStoryAnalysisUseCase.java`; `app/ai-worker/src/narrativex_worker/worker.py`; `service.py`; `providers/ports.py`; `providers/disabled.py`; `contracts/job-event.v1.schema.json`.
Current behavior: A job row can be created without a durable handoff or safe external-operation lifecycle.  
Expected behavior: Reserve cost before submission, publish a durable job event, claim with lease/idempotency, persist provider operation state, represent ambiguity as `UNKNOWN`, and reconcile before retry.  
Impact: Jobs can remain inert, duplicate external work, or lose the authoritative state transition during restart/failure.  
Risk type: reliability, cost control, provider safety  
Recommended owner: backend and worker  
Target milestone: W1-D2 and W2-D3  
Dependencies: PostgreSQL startup gate, queue contract, provider fake, and operation state machine.  
Closure test: Deterministic fake-provider integration test covers enqueue, worker restart, duplicate delivery, ambiguous submission, reconciliation, and terminal attribution.  
Blocks next phase: YES  
Status: OPEN

### NX-W1-D1-005

Severity: P1  
Component: backend/frontend  
Title: API and error contracts are incomplete for the target flows  
Evidence: Only six API routes are implemented: project list/create, story create, analysis enqueue, job lookup, and provider-health. There is no story read/update, upload, progress stream, chapter/storyboard mutation, render/export, or stable authorization/not-found/conflict/5xx error mapping.  
File/line or command: `ProjectController.java:18-55`; `GenerationJobController.java:10-24`; `ProviderHealthController.java:9-34`; `ApiExceptionHandler.java:10-31`; `documentation/codebase/FRONTEND_API_INTEGRATION_MATRIX.md`.  
Current behavior: The frontend target flow has no complete server contract and the exception handler covers only argument and validation failures.  
Expected behavior: Versioned DTOs and problem responses define ownership, validation, conflict/If-Match, idempotency, job progress, and terminal error semantics.  
Impact: UI integration would require ad hoc assumptions and would hide important failure states.  
Risk type: API compatibility, correctness, operability  
Recommended owner: backend  
Target milestone: W1-D2 and W2  
Dependencies: Confirm product flow boundaries and async state model.  
Closure test: Contract tests cover every matrix row that is marked API-backed, including 401/403/404/409/422/5xx responses.  
Blocks next phase: NO  
Status: OPEN

### NX-W1-D1-006

Severity: P1  
Component: database/backend  
Title: H2 test profile bypasses PostgreSQL migrations  
Evidence: Tests use H2 in-memory storage with `ddl-auto=create-drop` and Flyway disabled, while production uses PostgreSQL and schema validation.  
File/line or command: `app/backend-service/src/test/resources/application-test.yml:1-16`.  
Current behavior: The passing context test does not validate V1-V3 SQL, PostgreSQL types/indexes/constraints, or migration ordering.  
Expected behavior: At least one repeatable integration gate boots against PostgreSQL and applies the real migration chain.  
Impact: The P0 fresh-database failure can pass unnoticed in the default test suite.  
Risk type: test coverage, deployment reliability  
Recommended owner: backend/QA  
Target milestone: W1-D4  
Dependencies: Test-container or Compose PostgreSQL strategy and deterministic cleanup.  
Closure test: CI/local verification starts empty PostgreSQL and runs migration plus repository smoke tests.  
Blocks next phase: YES  
Status: OPEN

### NX-W1-D1-007

Severity: P1  
Component: infrastructure/security  
Title: Local infrastructure has exposed defaults and no app runtime composition  
Evidence: Compose publishes PostgreSQL, Redis, and MinIO on host ports with default local passwords/secrets and starts dependencies only; backend, worker, and frontend are not composed with healthchecks or a single documented app profile.  
File/line or command: `docker-compose.yml`; `infrastructure/README.md`; `.env.example`.  
Current behavior: A developer can start dependencies, but the full runtime topology is not reproducible from Compose and defaults are unsafe outside a local machine.  
Expected behavior: Local-only exposure is explicit, credentials are override-required outside local mode, and the supported app/dependency startup path is documented and health-checked.  
Impact: Environment drift and accidental network exposure are likely.  
Risk type: infrastructure, secrets, operability  
Recommended owner: platform  
Target milestone: W1-D3  
Dependencies: Decide whether app containers are in scope for W1 or document the intentional split.  
Closure test: Compose security/config check rejects unsafe non-local defaults and all documented services pass healthchecks.  
Blocks next phase: NO  
Status: OPEN

### NX-W1-D1-008

Severity: P2  
Component: database  
Title: Foreign-key access paths are not explicitly indexed  
Evidence: The core migration adds an owner/status index for projects but does not add explicit indexes for most foreign-key columns such as project, story version, job, chapter, or scene references.  
File/line or command: `V2__create_core_schema.sql`; `V3__add_rights_and_control_plane.sql`.  
Current behavior: Query plans may rely on sequential scans or incidental indexes as data grows.  
Expected behavior: Indexes follow measured ownership/status/job polling and relationship queries, with constraints retained separately from access paths.  
Impact: Potential latency and lock/maintenance pressure at scale.  
Risk type: performance, operability  
Recommended owner: database/backend  
Target milestone: W1-D4  
Dependencies: Finalize query shapes and capture EXPLAIN evidence before adding indexes.  
Closure test: Query/index inventory and representative EXPLAIN plans demonstrate acceptable access paths.  
Blocks next phase: NO  
Status: OPEN

### NX-W1-D1-009

Severity: P2  
Component: frontend/docs  
Title: Documentation and route surface have drift/dead entries  
Evidence: The frontend README says Next.js 15 while `package.json` uses Next 16.3.1. Newly present assets/presets store/components have no corresponding render branches in `page.tsx`; notification/settings entries are also non-functional surfaces.  
File/line or command: `app/frontend-web/README.md`; `package.json`; `src/app/page.tsx`; `src/components/layout/StudioSidebar.tsx`; current untracked assets/presets files.  
Current behavior: Operators and developers can infer unsupported routes/features from stale or dead UI entries.  
Expected behavior: Documentation, navigation, and rendered route capabilities agree, or entries are explicitly marked as planned.  
Impact: Misleading acceptance evidence and avoidable integration confusion.  
Risk type: documentation, product correctness  
Recommended owner: frontend/docs  
Target milestone: W1-D2 or scheduled UI integration milestone  
Dependencies: Preserve the concurrent user asset/preset work and decide its target screen scope.  
Closure test: Route/README audit has no version mismatch or unhandled navigation entry.  
Blocks next phase: NO  
Status: VERIFIED for the W1-D2 documentation baseline. Current `app/page.tsx` renders Assets and Style Presets, so those surfaces are MOCK/reachable rather than DEAD. The frontend README now matches Next.js 16.3.1. Notification/settings remain non-functional sidebar controls and are not classified as rendered business integrations.

### W1-D2 closure note for NX-W1-D1-005

W1-D2 closes the shared HTTP ProblemDetail/correlation boundary, typed frontend error parsing and the application/API dependency violations. The target Project/Story/Asset/Job resource contracts and visible API wiring remain intentionally open for W2-D1+.
