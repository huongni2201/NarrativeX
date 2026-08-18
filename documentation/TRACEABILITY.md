# V1.8 traceability and delivery status

This matrix distinguishes the V1.8 product/domain intent from the implementation state in this repository. The specification defines the target contract; current code, migrations, contracts and accepted ADRs define factual AS-IS claims. This file is a navigation and status aid, not a replacement specification.

| Source-of-truth area | Maintained repository reference | Current delivery status |
| --- | --- | --- |
| Product scope, actors, functional requirements | attached `NARRATIVEX_PROJECT_SPEC_V1_8.md`, `documentation/product/PRODUCT_SPEC.md`, `FEATURE_CATALOG.md` | V1.8 contract; production gates remain explicit |
| Business rules and state transitions | `documentation/domain/BUSINESS_RULES.md`, `DOMAIN_MODEL.md` | Documented; per-story copyright/rights attestation is no longer an Analyze/Generate prerequisite and the consolidated Flyway baseline excludes the retired rights schema |
| Terms and stable domain codes | `documentation/domain/GLOSSARY.md` | Documented |
| System topology and deployment | `documentation/architecture/SYSTEM_ARCHITECTURE.md`, `TECHNOLOGY_STACK.md` | Documented; frontend same-origin proxy/build-time routing contract and Redis-backed shared HTTP-session boundary are explicit |
| Data flow and service/module boundaries | `documentation/architecture/DATA_FLOW.md`, `SERVICE_BOUNDARIES.md` | Chapter-first durable flow documented; application use cases are transport-agnostic; runtime execution remains incomplete |
| Authentication/runtime security | `documentation/decisions/ADR-0004-authentication-and-frontend-runtime-security.md`, `ADR-0008-redis-backed-http-sessions.md` | Fail-closed profile guard, canonical frontend auth routing, Redis-backed login/register abuse limiting, and Spring Session Redis are implemented; current browser auth remains session + CSRF and JWT/access/refresh-token migration is deferred |
| Frontend implementation/runtime map | `documentation/codebase/FRONTEND_CODEBASE.md`, `FRONTEND_API_INTEGRATION_MATRIX.md`, `app/frontend-web/README.md` | Current route/state/API/CI behavior documented against implementation |
| Durable generation execution | `documentation/decisions/ADR-0001-system-topology-and-durable-execution.md`, `ADR-0002-chapter-first-workflow-and-routes.md` | Production contract documented; Chapter analysis remains explicitly unavailable until durable enqueue/worker execution exists; there is no toggle that bypasses this gate |
| Source layout and module responsibilities | `documentation/codebase/*`, `app/*/README.md` | Base project map maintained with the code skeleton |
| Backend ↔ worker payloads | `contracts/*` | Versioned schema exists; durable intake/lease/reconciliation integration remains a release gate |
| Local infrastructure | `docker-compose.yml`, root/module READMEs | PostgreSQL, Redis and MinIO local baseline; Redis also stores Spring Session state; frontend image is separately buildable and requires an explicit backend destination when containerized |

## Deliberate non-claims

The repository is a runnable foundation, not yet a public-production implementation. Real Vertex/Gemini, image, TTS, video, object-storage, moderation, billing, durable worker dispatch and email integrations require environment credentials and contract/E2E verification. A deterministic fake provider is suitable for tests only and must not be reported as production health.

The frontend quality gate includes `npm test`, but the current Node test suite primarily protects architecture/tooling regressions. It must not be interpreted as complete behavioral component, accessibility or end-to-end coverage.

The backend quality gate includes JaCoCo report generation and a bootstrap bundle-level minimum line-coverage threshold. That threshold is a regression floor only; passing it must not be interpreted as broad behavioral coverage or production readiness.

Creating a Project is metadata-only and must not enqueue analysis. The backend must not report Chapter analysis as accepted/queued unless that work has a durable execution path. Until the transaction `OperationPlan/authorization-reservation → GenerationJob → StageAttempt(s) → OutboxEvent` and post-commit dispatch/worker lease path are implemented and tested, `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs` returns `FEATURE_NOT_AVAILABLE` without creating queued rows. The obsolete story-analysis runtime toggle has been removed so configuration cannot imply that an incomplete execution path is enabled.

Before public beta, the release gate must still prove ownership/authentication, account abuse limits before provider work, input/output moderation, real-person consent where applicable, prompt-injection fixtures, server-side entitlement, cost reservation/reconciliation, chapter source persistence and resume/incremental scope, notification/outbox delivery, deletion lifecycle, backup/restore, observability, frontend behavioral/E2E coverage, and no P0/P1 security or safety blockers. The current password-auth rate limiter closes the login/register brute-force gap, but broader route/resource-class abuse controls remain part of the production gate.

## V1.8 implementation boundary

| V1.8 area | Repository evidence | Status |
|---|---|---|
| Project list/create and cursor pagination | Project controller/use cases, `CursorPage`, consolidated V1 baseline, V3 active-project partial index and frontend Query integration | IMPLEMENTED foundation; Create Project is metadata-only; active listing uses keyset pagination with an index matching `archived_at IS NULL` |
| Project search/filter UX | `ProjectsDashboard`, URL `status`/`q`, 300 ms search URL debounce | IMPLEMENTED client boundary; full-collection server-side filtering still requires backend query support |
| Frontend canonical auth routing | `AuthEntry`, `/auth`, `/projects` | IMPLEMENTED boundary; authenticated `/auth` replaces to `/projects` |
| Frontend transport/proxy | `src/shared/api/client.ts`, `next.config.mjs`, frontend Dockerfile | IMPLEMENTED foundation; typed protocol errors and explicit Docker build-time backend destination; runtime-neutral proxy remains future option for single-image promotion |
| Frontend quality gate | `.github/workflows/frontend-ci.yml`, `package.json`, architecture tests | IMPLEMENTED foundation; `npm test`, lint/architecture, type-check and build run in CI; behavioral/E2E suite remains pending |
| StoryVersion create | Project story command/persistence and frontend create flow | IMPLEMENTED foundation; active StoryVersion contract contains no per-story rights-attestation prerequisite; consolidated V1 baseline excludes retired rights schema |
| Story-size preflight | StoryVersion validation/error mapping and multilingual estimator tests | IMPLEMENTED foundation; character and estimated-token limits produce stable distinct errors; provider/model tokenizer validation is still required at execution time |
| Authentication | Spring Security session/CSRF, password auth, Google OIDC, startup guard, Redis auth limiter, Spring Session Redis, `NX_SESSION` cookie | IMPLEMENTED foundation; shared session state stored in Redis with configurable timeout/namespace; login/register rate limited; logout invalidates session and returns 204; JWT/access/refresh-token migration not yet implemented |
| Chapter analysis enqueue | Generation controller/use case/domain scaffold + frontend helper | **UNAVAILABLE**; route is `/api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs`; returns `FEATURE_NOT_AVAILABLE` until durable transaction, stage/outbox dispatch, worker claim/lease and reconciliation exist; no feature toggle overrides this boundary |
| Generation job read | Generation job query/controller | Scaffold/read contract exists; meaningful runtime progress requires durable worker updates |
| Reusable character domain | Character/ProjectCharacter/version/appearance/outfit domain and persistence plus tests | IMPLEMENTED foundation; public REST contract pending |
| Chapter/storyboard model | `Chapter` + `Scene` aggregate roots, `VisualBeat` child entity, Scene lifecycle tests, JPA mappings, ADR-0007 | PARTIAL domain foundation; Chapter source persistence alignment, repositories/application commands/public API pending |
| Optimistic concurrency | Aggregate `rowVersion`, JPA `@Version`, explicit detached-domain version guards and regression tests | IMPLEMENTED foundation for current mutable persistence adapters; public ETag/`If-Match` coverage remains incomplete for APIs that expose concurrent edits |
| Application/API separation | Project, Character and Generation use cases/controllers plus architecture tests | IMPLEMENTED boundary; application use cases return application/domain results and controllers map them to API response DTOs/wrappers |
| Frontend runtime data mode | API default and unsupported-capability states | IMPLEMENTED boundary; unsupported production capabilities remain explicit |
| AI worker | Typed provider-neutral schema/ports, untrusted-story boundary, disabled provider | PORT_ONLY; durable intake, lease, storage, media and real adapters pending |
| Safety/notification/entitlement/abuse/deletion | consolidated schema control-plane section | Schema foundation; application executors remain pending |

## P1/P2 backend safety and correctness invariants

1. The shared backend artifact has no `spring.profiles.default=local`.
2. With OIDC disabled, only explicit active profiles made exclusively of `local` and/or `test` may start.
3. No active profile, `prod`, `production`, `staging`, `qa`, `uat`, preview or any unknown profile must fail startup when OIDC is disabled.
4. PostgreSQL Testcontainers migration verification runs with explicit `test` profile and PostgreSQL datasource/dialect overrides so both the security startup guard and authoritative migration path are exercised in CI.
5. Password login and registration are subject to server-side Redis-backed abuse limits and return `429` + `Retry-After` when exceeded.
6. Shared/default browser sessions use Spring Session Redis with an opaque `NX_SESSION`; shared environments use Secure cookies, while the explicit local/test override may disable Secure for HTTP localhost/test.
7. Redis session availability is distinct from the fail-open auth-rate-limiter policy: Redis loss may invalidate active sessions, but it must not lose durable PostgreSQL business state.
8. Create Project must not enqueue AI/media work; Chapter analysis must not return `202 QUEUED` while there is no durable worker execution path, and configuration must not expose a misleading enable switch for that scaffold.
9. Provider submission must eventually use a dedicated `ProviderOperationStatus` lifecycle with `RESERVED`, `SUBMITTED`, `RUNNING`, `COMPLETED`, `FAILED`, `UNKNOWN`; `UNKNOWN` reconciles before resubmission.
10. A containerized frontend must not rely on its own `localhost:8080` as the backend service address; the proxy destination must match the deployment topology.
11. Authenticated application content must not be served under the canonical `/auth` entry URL.
12. Mutable persistence adapters must compare expected detached-domain `rowVersion` with the loaded persistence version before applying state; stale objects must fail instead of overwriting newer rows.
13. Application use cases must not return HTTP/API transport response wrappers; mapping to the public API contract belongs to controllers/adapters.
14. Story character-limit and estimated-token-limit failures must remain distinct stable errors; the multilingual token estimate is a preflight heuristic and never replaces model-specific token validation.
15. Active-project cursor pagination must retain its matching partial PostgreSQL index while the query continues to filter `archived_at IS NULL` and order by `(updated_at DESC, id DESC)`.
16. Backend `clean verify` must produce the JaCoCo report and enforce the configured minimum coverage floor in addition to tests and formatting checks.
