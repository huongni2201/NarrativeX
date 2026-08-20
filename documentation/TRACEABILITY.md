# Current implementation traceability

This matrix distinguishes the product/domain source of truth from the implementation state in this repository. The specification defines target behavior; current code, migrations, contracts and accepted ADRs define factual AS-IS claims. This file is a navigation and status aid, not a replacement specification.

> Delivery note: the Chapter Analysis vertical slice is implemented in the current codebase. P2 throughput, workspace-read, outbox-transaction and architecture hardening are carried by PR #53 and PR #54 until merged to `main`. Public-production readiness still has explicit gaps listed below.

| Source-of-truth area | Maintained repository reference | Current delivery status |
| --- | --- | --- |
| Product scope, actors, functional requirements | latest NarrativeX project specification, `documentation/product/PRODUCT_SPEC.md`, `FEATURE_CATALOG.md` | Product contract; production gates remain explicit |
| Business rules and state transitions | `documentation/domain/BUSINESS_RULES.md`, `DOMAIN_MODEL.md` | Documented; per-story copyright/rights attestation is not an Analyze/Generate prerequisite |
| Terms and stable domain codes | `documentation/domain/GLOSSARY.md` | Documented |
| System topology and deployment | `documentation/architecture/SYSTEM_ARCHITECTURE.md`, `TECHNOLOGY_STACK.md` | PostgreSQL is authoritative; Redis is non-authoritative delivery/progress/session infrastructure; worker is a separate runtime boundary |
| Data flow and service/module boundaries | `documentation/architecture/DATA_FLOW.md`, `SERVICE_BOUNDARIES.md` | Chapter-first durable analysis path is implemented as an MVP foundation; production cost/safety/provider-reconciliation gates remain incomplete |
| Authentication/runtime security | `documentation/decisions/ADR-0004-authentication-and-frontend-runtime-security.md`, `ADR-0008-redis-backed-http-sessions.md` | Spring Security session/CSRF, Google OIDC/password auth, Redis-backed session and abuse-control foundations are implemented |
| Frontend implementation/runtime map | `documentation/codebase/FRONTEND_CODEBASE.md`, `FRONTEND_API_INTEGRATION_MATRIX.md`, `app/frontend-web/README.md` | Chapter source editor, Analyze/job polling and current Storyboard workspace integration use backend runtime data; legacy production workspace mocks are removed by PR #54 |
| Durable generation execution | `documentation/decisions/ADR-0001-system-topology-and-durable-execution.md`, `ADR-0002-chapter-first-workflow-and-routes.md` | MVP enqueue, persisted snapshot, StageAttempt, outbox intent, PostgreSQL worker claim/lease/heartbeat and ProviderOperation CAS/reconciliation foundation are implemented |
| Backend ↔ worker Chapter analysis contract | backend generation snapshot columns, `app/ai-worker/src/narrativex_worker/schema.py` | Snapshot-scoped by project/story/chapter/rowVersion/sourceHash/sourceText; worker concurrency is configurable; shared versioned cross-language schema remains recommended |
| Local infrastructure | `docker-compose.yml`, root/module READMEs | PostgreSQL, Redis, MinIO and AI worker local baseline; worker defaults to disabled provider and can use Vertex mode with ADC credentials |

## Deliberate non-claims

The repository is not yet a public-production implementation. The Chapter-analysis foundation now enforces the MVP entitlement/quota and cost reservation boundary and persists ProviderOperation state with `UNKNOWN` reconciliation. Production readiness still requires complete moderation/safety coverage, notification delivery, backup/restore, observability, billing-ledger reconciliation and full real-provider E2E coverage.

The Vertex Gemini adapter is a real adapter, but its presence in source does not prove production provider health. `provider_mode=disabled` remains the safe default and must never fake successful AI output.

Creating a Project is metadata-only and must not enqueue analysis. Saving a Chapter also does not implicitly analyze it. Analysis is an explicit action on a persisted Chapter. The backend snapshots the saved Chapter identity and source into the durable job; the client does not submit arbitrary source text as the analysis authority.

## Current implementation boundary

| Area | Repository evidence | Status |
|---|---|---|
| Project list/create and cursor pagination | Project controller/use cases, `CursorPage`, migrations and frontend Query integration | IMPLEMENTED foundation |
| Project metadata | Project aggregate/JPA/response | IMPLEMENTED; `description` and `coverImageUrl` are part of current Project domain/response |
| Frontend canonical auth routing | `AuthEntry`, `/auth`, `/projects` | IMPLEMENTED boundary |
| Frontend transport/proxy | `src/shared/api/client.ts`, `next.config.mjs`, frontend Dockerfile | IMPLEMENTED foundation |
| StoryVersion create/activate | Project story command/persistence flows | IMPLEMENTED foundation |
| Chapter CRUD/source snapshot | Chapter controller/use cases/repository, `sourceText`, SHA-256 `sourceHash`, optimistic `rowVersion`, ETag/`If-Match`, Chapter editor | IMPLEMENTED foundation |
| Chapter analysis enqueue | `ProjectGenerationController`, `EnqueueStoryAnalysisUseCase`, generation repositories | IMPLEMENTED; `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs` returns `202 Accepted` after durable enqueue |
| Generation outbox dispatch | `GenerationOutboxDispatcher` | IMPLEMENTED; PostgreSQL outbox is durable and Redis is only a best-effort hint. PR #54 reserves rows in a short DB transaction and publishes after commit |
| Generation job read | `GenerationJobController`, generation query/use case | IMPLEMENTED foundation; canonical route is `GET /api/v1/generation-jobs/{jobId}` |
| Worker claim/lease/heartbeat | `app/ai-worker/src/narrativex_worker/repository.py`, `worker.py` | IMPLEMENTED; PostgreSQL `FOR UPDATE ... SKIP LOCKED`, heartbeat and stale-lease recovery are present |
| Worker process concurrency | `WorkerSettings.worker_concurrency`, `NarrativeXWorker` | P2 IMPLEMENTED in PR #53; default 4, bounded 1..32, multiple jobs may be in flight per process |
| Worker DB/materialization efficiency | `WorkerRepository` | P2 IMPLEMENTED in PR #53; pool scales with concurrency and Character/Scene/VisualBeat writes are batched where practical |
| Re-analysis safety | worker materialization transaction | P2 IMPLEMENTED in PR #53; stale Chapter snapshots are rejected and approved Scene/VisualBeat output cannot be destructively replaced without explicit reset/versioning flow |
| Chapter Workspace read model | `ChapterWorkspaceReadRepository`, `JdbcChapterWorkspaceQueryAdapter` | P2 IMPLEMENTED in PR #54; application layer no longer owns JDBC/SQL and workspace projection is reduced to one aggregate CTE + one bounded preview query |
| Architecture enforcement | `ArchitectureRulesTest` | P2 IMPLEMENTED in PR #54; application code is prevented from importing Spring JDBC, Spring Data JPA or Jakarta Persistence |
| AI result materialization | worker repository + Character/ProjectCharacter/CharacterVersion + Scene/VisualBeat | IMPLEMENTED foundation; worker validates Chapter snapshot before transactional materialization |
| Durable ProviderOperation lifecycle | Generation domain/provider lifecycle target | IMPLEMENTED foundation; reconciliation leasing, billing observability and real-provider operations remain production hardening |
| Frontend JobStatus contract | `src/types/api.ts`, `scripts/job-status-contract.test.mjs` | IMPLEMENTED; backend spelling is canonical, `CANCELED` is terminal and `PAUSED_COST_LIMIT` remains active |
| Legacy production mock workspace | `features/production/ChapterWorkspace.tsx`, `Storyboard.tsx` | REMOVED by PR #54; current Chapter/Storyboard surfaces must use real runtime data |
| Image/TTS/render | provider/domain foundations | OUT OF CURRENT VERTICAL SLICE |

## Chapter Analysis vertical slice definition of done

The implemented MVP path is:

```text
Save Chapter
  -> POST /projects/{projectId}/chapters/{chapterId}/analysis-jobs
  -> QUEUED
  -> worker claim + heartbeat
  -> RUNNING
  -> configured provider structured Chapter analysis
  -> Character / ProjectCharacter / CharacterVersion
  -> Scene / VisualBeat
  -> COMPLETED
  -> frontend observes terminal state
```

Required production-level verification still includes real-provider smoke/E2E, restart/stale-lease tests under load, entitlement/cost/safety gates, durable ProviderOperation reconciliation and broader observability.

## P1/P2 safety, correctness and performance invariants

1. Create Project and Save Chapter must not implicitly enqueue AI/media work; Analyze is explicit.
2. Analysis authority is the backend-loaded persisted Chapter snapshot identified by `chapterId + rowVersion + sourceHash`.
3. Durable enqueue persists OperationPlan, GenerationJob, StageAttempt and outbox intent before any Redis hint.
4. Redis is not authoritative for GenerationJob state. Redis failure may delay hints but must not lose PostgreSQL work.
5. Outbox dispatch must not hold a PostgreSQL transaction open while waiting on Redis network I/O.
6. Worker claim/lease/heartbeat state is PostgreSQL-backed and uses `FOR UPDATE ... SKIP LOCKED` for safe competing claims.
7. A worker process may run bounded concurrent Chapter jobs; concurrency is configuration, not unbounded task creation.
8. Graceful worker shutdown stops new claims and allows current in-flight jobs to finish before database pool close.
9. Worker materialization must re-check Chapter snapshot identity before committing AI results.
10. Re-analysis must not silently delete approved Scene/VisualBeat output; explicit reset/versioning is required first.
11. Chapter Workspace application code must depend on an outbound read port rather than JDBC/JPA implementation details.
12. Workspace read paths should avoid N+1/chatty aggregate queries; current projection uses one aggregate query plus one bounded preview query.
13. Application-layer imports of Spring JDBC, Spring Data JPA and Jakarta Persistence are architecture violations.
14. Backend/FE JobStatus spelling must remain aligned; `COMPLETED`, `FAILED`, `CANCELED` are terminal statuses.
15. `PAUSED_COST_LIMIT`, `QUEUED`, `RUNNING`, `STALLED` and `UNKNOWN` must not be treated as terminal by FE polling.
16. Provider submission target lifecycle is `RESERVED -> UNKNOWN -> SUBMITTED/RUNNING/COMPLETED/FAILED` with `SUBMITTED`/`RUNNING` reconciliation branches; `COMPLETED`/`FAILED` are terminal and every worker mutation uses status + `row_version` CAS.
17. Mutable persistence adapters must reject stale detached-domain `rowVersion` rather than overwriting newer rows.
18. Backend `clean verify` must pass tests, architecture checks, coverage and formatting; worker CI must pass Ruff, format, mypy and pytest; frontend CI must pass tests, lint, type-check and build.
