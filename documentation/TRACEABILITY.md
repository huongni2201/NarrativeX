# V1.8 traceability and delivery status

This matrix distinguishes the V1.8 product/domain intent from the implementation state in this repository. The specification defines the target contract; current code, migrations, contracts and accepted ADRs define factual AS-IS claims. This file is a navigation and status aid, not a replacement specification.

> Delivery note: the Chapter Analysis Vertical Slice is implemented on `agent/chapter-analysis-vertical-slice` / PR #38 and remains a draft until CI and end-to-end verification are complete. Items marked IMPLEMENTED FOUNDATION describe code present on that branch, not public-production readiness.

| Source-of-truth area | Maintained repository reference | Current delivery status |
| --- | --- | --- |
| Product scope, actors, functional requirements | attached `NARRATIVEX_PROJECT_SPEC_V1_8.md`, `documentation/product/PRODUCT_SPEC.md`, `FEATURE_CATALOG.md` | V1.8 contract; production gates remain explicit |
| Business rules and state transitions | `documentation/domain/BUSINESS_RULES.md`, `DOMAIN_MODEL.md` | Documented; per-story copyright/rights attestation is not an Analyze/Generate prerequisite and the consolidated Flyway baseline excludes the retired rights schema |
| Terms and stable domain codes | `documentation/domain/GLOSSARY.md` | Documented |
| System topology and deployment | `documentation/architecture/SYSTEM_ARCHITECTURE.md`, `TECHNOLOGY_STACK.md` | Documented; PostgreSQL is authoritative, Redis is non-authoritative delivery/progress/session infrastructure, and the worker is a separate runtime boundary |
| Data flow and service/module boundaries | `documentation/architecture/DATA_FLOW.md`, `SERVICE_BOUNDARIES.md` | Chapter-first durable analysis path is implemented as an MVP foundation; production cost/safety/provider-reconciliation gates remain incomplete |
| Authentication/runtime security | `documentation/decisions/ADR-0004-authentication-and-frontend-runtime-security.md`, `ADR-0008-redis-backed-http-sessions.md` | Fail-closed profile guard, canonical frontend auth routing, Redis-backed login/register abuse limiting, Spring Session Redis and CSRF are implemented; JWT/access/refresh-token migration is deferred |
| Frontend implementation/runtime map | `documentation/codebase/FRONTEND_CODEBASE.md`, `FRONTEND_API_INTEGRATION_MATRIX.md`, `app/frontend-web/README.md` | Chapter source editor and Chapter Analyze/job polling are connected to backend APIs; Character/Storyboard result read APIs remain pending |
| Durable generation execution | `documentation/decisions/ADR-0001-system-topology-and-durable-execution.md`, `ADR-0002-chapter-first-workflow-and-routes.md` | MVP Chapter-analysis enqueue, persisted snapshot, StageAttempt, outbox dispatch hint, PostgreSQL worker claim/lease/heartbeat and terminal job updates are implemented; durable ProviderOperation persistence/reconciliation is still pending |
| Backend ↔ worker Chapter analysis contract | backend generation snapshot columns, `app/ai-worker/src/narrativex_worker/schema.py` | `ChapterAnalysisRequest` is snapshot-scoped by project/story/chapter/rowVersion/sourceHash/sourceText; obsolete rights-attestation fields are removed; a shared versioned cross-language request schema is still recommended |
| Local infrastructure | `docker-compose.yml`, root/module READMEs | PostgreSQL, Redis, MinIO and AI worker local baseline; worker defaults to disabled provider and can use Vertex mode with ADC credentials |

## Deliberate non-claims

The repository is not yet a public-production implementation. The Chapter-analysis foundation now crosses the real durability boundary, but production readiness still requires verified cost reservation/reconciliation, moderation and entitlement gates, durable ProviderOperation persistence and `UNKNOWN` reconciliation, broader abuse controls, notification delivery, backup/restore, observability and full real-provider E2E coverage.

The Vertex Gemini adapter is a real adapter, but its presence in source does not prove production provider health. `provider_mode=disabled` remains the safe default and must never fake successful AI output. Vertex mode requires valid ADC/workload identity, project/location/model configuration and real-provider verification.

The frontend quality gate includes `npm test`, but the current Node test suite primarily protects architecture/tooling regressions. It must not be interpreted as complete behavioral component, accessibility or end-to-end coverage.

The backend quality gate includes JaCoCo report generation and a bootstrap bundle-level minimum line-coverage threshold. That threshold is a regression floor only; passing it must not be interpreted as broad behavioral coverage or production readiness.

Creating a Project is metadata-only and must not enqueue analysis. Saving a Chapter also does not implicitly analyze it. Analysis is an explicit action on a persisted Chapter. The backend snapshots the saved Chapter identity and source into the durable job; the client does not submit arbitrary source text as the analysis authority.

Before public beta, the release gate must still prove ownership/authentication, broader account and resource-class abuse limits, input/output moderation, real-person consent where applicable, prompt-injection fixtures, server-side entitlement, cost reservation/reconciliation, resume/incremental scope, durable ProviderOperation reconciliation, notification/outbox delivery, deletion lifecycle, backup/restore, observability, frontend behavioral/E2E coverage, and no P0/P1 security or safety blockers.

## V1.8 implementation boundary

| V1.8 area | Repository evidence | Status |
|---|---|---|
| Project list/create and cursor pagination | Project controller/use cases, `CursorPage`, consolidated V1 baseline, V5 active-project partial index and frontend Query integration | IMPLEMENTED foundation; Create Project is metadata-only; active listing uses keyset pagination with an index matching `archived_at IS NULL` |
| Project search/filter UX | `ProjectsDashboard`, URL `status`/`q`, 300 ms search URL debounce | IMPLEMENTED client boundary; full-collection server-side filtering still requires backend query support |
| Frontend canonical auth routing | `AuthEntry`, `/auth`, `/projects` | IMPLEMENTED boundary; authenticated `/auth` replaces to `/projects` |
| Frontend transport/proxy | `src/shared/api/client.ts`, `next.config.mjs`, frontend Dockerfile | IMPLEMENTED foundation; typed protocol errors and explicit Docker build-time backend destination |
| Frontend quality gate | `.github/workflows/frontend-ci.yml`, `package.json`, architecture tests | IMPLEMENTED foundation; behavioral/E2E suite remains pending |
| StoryVersion create | Project story command/persistence and frontend create flow | IMPLEMENTED foundation; no per-story rights-attestation prerequisite |
| Story-size preflight | StoryVersion validation/error mapping and multilingual estimator tests | IMPLEMENTED foundation; provider/model tokenizer validation is still required at execution time |
| Authentication | Spring Security session/CSRF, password auth, Google OIDC, startup guard, Redis auth limiter, Spring Session Redis, `NX_SESSION` cookie | IMPLEMENTED foundation; JWT/access/refresh-token migration not implemented |
| Chapter CRUD/source snapshot | Chapter controller/use cases/repository, `sourceText`, SHA-256 `sourceHash`, optimistic `rowVersion`, ETag/`If-Match`, frontend Chapter editor | IMPLEMENTED foundation; create/list/get/update are public and source identity is server-persisted |
| Chapter analysis enqueue | `EnqueueStoryAnalysisUseCase`, generation repositories, V6 migration, StageAttempt/outbox adapters | IMPLEMENTED FOUNDATION on PR #38; one transaction persists OperationPlan + GenerationJob Chapter snapshot + StageAttempt + outbox intent with idempotency by persisted Chapter source identity |
| Generation outbox dispatch | generation outbox adapter/dispatcher, Redis publisher | IMPLEMENTED FOUNDATION on PR #38; dispatch occurs after durable DB state and Redis remains a delivery hint rather than source of truth |
| Generation job read | `GenerationJobController`, generation query/use case | IMPLEMENTED foundation; canonical route is `GET /api/v1/generation-jobs/{jobId}` with `/api/v1/jobs/{jobId}` compatibility alias |
| Worker claim/lease/heartbeat | `app/ai-worker/src/narrativex_worker/repository.py`, `worker.py` | IMPLEMENTED FOUNDATION on PR #38; PostgreSQL `FOR UPDATE ... SKIP LOCKED`, heartbeat and stale-lease recovery are present |
| Chapter analysis worker contract | `schema.py`, `prompting.py`, provider ports | IMPLEMENTED FOUNDATION; `ChapterAnalysisRequest` includes `projectId`, `storyVersionId`, `chapterId`, `chapterRowVersion`, `sourceHash`, `sourceText`, `sourceLanguage`; story source remains an untrusted prompt-data boundary |
| Real LLM adapter | `providers/vertex.py` | IMPLEMENTED FOUNDATION; one Vertex Gemini adapter via ADC with structured JSON/Pydantic validation; production credential/E2E verification pending |
| AI result materialization | worker repository + Character/ProjectCharacter/CharacterVersion + Scene/VisualBeat tables | IMPLEMENTED FOUNDATION; worker transaction validates the Chapter snapshot, then materializes Character and storyboard rows before marking the job completed |
| Durable ProviderOperation lifecycle | Generation domain + provider port lifecycle contract | PARTIAL; canonical `RESERVED -> SUBMITTED -> RUNNING -> COMPLETED/FAILED/UNKNOWN` remains the target, but dedicated durable ProviderOperation persistence/reconciliation is not complete |
| Reusable character domain | Character/ProjectCharacter/version/appearance/outfit domain and persistence plus tests | IMPLEMENTED foundation; public Character read/edit/approval REST contract remains pending |
| Chapter storyboard model | `Chapter`, `Scene`, `VisualBeat`, JPA mappings and AI materialization | IMPLEMENTED/PARTIAL; persisted AI Scene/VisualBeat output exists, but public Scene/VisualBeat read/edit/approval APIs remain pending |
| Optimistic concurrency | Aggregate `rowVersion`, JPA `@Version`, detached-domain version guards, Chapter ETag/`If-Match` | IMPLEMENTED foundation for current mutable APIs; expand consistently as Scene/Character public commands land |
| Frontend Analyze UX | `ChapterEditor`, `chaptersApi`, TanStack Query job polling | IMPLEMENTED FOUNDATION on PR #38; Analyze is disabled for dirty/empty Chapters, creates the Chapter analysis job, polls job status, displays progress and invalidates project-scoped queries after completion |
| Frontend Character/Storyboard result views | existing Character/production UI shells | PENDING API; backend public read contracts are required before these views can consume the newly materialized rows without mocks |
| Image/TTS/render | provider/domain foundations | OUT OF CURRENT VERTICAL SLICE; implement only after Chapter analysis is stable end-to-end |
| Safety/notification/entitlement/abuse/deletion | consolidated schema/control-plane docs | Schema/domain foundation; production executors remain pending |

## Chapter Analysis Vertical Slice definition of done

The vertical slice is considered complete only when all of the following are verified, not merely present in source:

```text
Save Chapter
  -> POST /projects/{projectId}/chapters/{chapterId}/analysis-jobs
  -> QUEUED
  -> worker claim + heartbeat
  -> RUNNING
  -> Vertex structured Chapter analysis
  -> Character / ProjectCharacter / CharacterVersion
  -> Scene / VisualBeat
  -> COMPLETED
  -> frontend observes terminal state
```

Required verification before the draft PR is promoted:

1. Backend CI passes `clean verify`, including Flyway migration verification.
2. Worker CI passes Ruff, format, mypy and pytest.
3. Frontend CI passes tests, lint/architecture, type-check and build.
4. PostgreSQL integration/E2E proves idempotent enqueue and no duplicate active work for the same persisted Chapter source snapshot.
5. Worker restart/stale lease recovery does not lose or duplicate canonical work.
6. Changing Chapter `rowVersion/sourceHash` during analysis prevents stale result materialization.
7. Real Vertex smoke test validates the structured result contract.
8. Public Character/Storyboard read APIs are added before the UI claims analysis results are browsable.

## P1/P2 backend safety and correctness invariants

1. The shared backend artifact has no `spring.profiles.default=local`.
2. With OIDC disabled, only explicit active profiles made exclusively of `local` and/or `test` may start.
3. No active profile, `prod`, `production`, `staging`, `qa`, `uat`, preview or any unknown profile must fail startup when OIDC is disabled.
4. PostgreSQL Testcontainers migration verification runs with explicit `test` profile and PostgreSQL datasource/dialect overrides.
5. Password login and registration are subject to server-side Redis-backed abuse limits and return `429` + `Retry-After` when exceeded.
6. Shared/default browser sessions use Spring Session Redis with an opaque `NX_SESSION`; shared environments use Secure cookies, while explicit local/test may disable Secure for HTTP localhost/test.
7. Redis session availability is distinct from durable generation state: Redis loss may invalidate sessions or delay hints, but it must not lose PostgreSQL business/job state.
8. Create Project and Save Chapter must not implicitly enqueue AI/media work; Analyze is an explicit persisted-Chapter action.
9. Analysis authority is the backend-loaded persisted Chapter snapshot. Client-supplied arbitrary source text must not bypass `chapterId + rowVersion + sourceHash` identity.
10. Durable enqueue persists OperationPlan, GenerationJob, StageAttempt and outbox intent in one transaction before any Redis hint.
11. Worker claim/lease/heartbeat state is PostgreSQL-backed; process memory and Redis are not authoritative.
12. Provider submission must use the dedicated `ProviderOperationStatus` lifecycle with `RESERVED`, `SUBMITTED`, `RUNNING`, `COMPLETED`, `FAILED`, `UNKNOWN`; `UNKNOWN` reconciles before resubmission. Dedicated durable persistence for this lifecycle remains required before production.
13. A containerized frontend must not rely on its own `localhost:8080` as the backend service address.
14. Authenticated application content must not be served under the canonical `/auth` entry URL.
15. Mutable persistence adapters must reject stale detached-domain `rowVersion` rather than overwriting newer rows.
16. Application use cases must not return HTTP/API transport wrappers; mapping belongs to controllers/adapters.
17. Story character-limit and estimated-token-limit failures remain distinct stable errors; multilingual token estimate is a preflight heuristic only.
18. Active-project cursor pagination must retain its matching V5 partial PostgreSQL index while the query filters `archived_at IS NULL` and orders by `(updated_at DESC, id DESC)`.
19. Backend `clean verify` must produce the JaCoCo report and enforce the configured minimum coverage floor in addition to tests and formatting checks.
