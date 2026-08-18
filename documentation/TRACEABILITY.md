# V1.8 traceability and delivery status

This matrix distinguishes the V1.8 product/domain intent from the implementation state in this repository. The specification defines the target contract; current code, migrations, contracts and accepted ADRs define factual AS-IS claims. This file is a navigation and status aid, not a replacement specification.

| Source-of-truth area | Maintained repository reference | Current delivery status |
| --- | --- | --- |
| Product scope, actors, functional requirements | attached `NARRATIVEX_PROJECT_SPEC_V1_8.md`, `documentation/product/PRODUCT_SPEC.md`, `FEATURE_CATALOG.md` | V1.8 contract; production gates remain explicit |
| Business rules and state transitions | `documentation/domain/BUSINESS_RULES.md`, `DOMAIN_MODEL.md` | Documented; per-story copyright/rights attestation is not an Analyze/Generate prerequisite and legacy rights persistence is removed through Flyway V7 |
| Terms and stable domain codes | `documentation/domain/GLOSSARY.md` | Documented |
| System topology and deployment | `documentation/architecture/SYSTEM_ARCHITECTURE.md`, `TECHNOLOGY_STACK.md` | Documented |
| Data flow and service/module boundaries | `documentation/architecture/DATA_FLOW.md`, `SERVICE_BOUNDARIES.md` | Target durable flow documented; runtime implementation remains incomplete |
| Authentication/runtime security | `documentation/decisions/ADR-0004-authentication-and-frontend-runtime-security.md` | Current contract is Spring Security session + CSRF; Redis-backed login/register abuse limiting is implemented; JWT/access/refresh-token migration is explicitly deferred |
| Durable generation execution | `documentation/decisions/ADR-0001-system-topology-and-durable-execution.md` | Production contract documented; story-analysis enqueue endpoint is feature-gated until durable enqueue/worker execution exists |
| Source layout and module responsibilities | `documentation/codebase/*`, `app/*/README.md` | Base project map maintained with the code skeleton |
| Backend ↔ worker payloads | `contracts/*` | Versioned schema exists; durable intake/lease/reconciliation integration remains a release gate |
| Local infrastructure | `docker-compose.yml`, root/module READMEs | PostgreSQL, Redis and MinIO local baseline |

## Deliberate non-claims

The repository is a runnable foundation, not yet a public-production implementation. Real Vertex/Gemini, image, TTS, video, object-storage, moderation, billing, durable worker dispatch and email integrations require environment credentials and contract/E2E verification. A deterministic fake provider is suitable for tests only and must not be reported as production health.

The backend must not report work as accepted/queued unless that work has a durable execution path. Until the transaction `OperationPlan/authorization-reservation → GenerationJob → StageAttempt(s) → OutboxEvent` and post-commit dispatch/worker lease path are implemented and tested, `POST /api/v1/projects/{projectId}/analysis-jobs` remains disabled by default and returns `FEATURE_NOT_AVAILABLE` without creating queued rows.

Before public beta, the release gate must still prove ownership/authentication, account abuse controls before provider work, input/output moderation, real-person consent where applicable, prompt-injection fixtures, server-side entitlement, cost reservation/reconciliation, chapter resume/incremental scope, notification/outbox delivery, deletion lifecycle, backup/restore, observability, and no P0/P1 security or safety blockers. The current password-auth rate limiter closes the login/register brute-force gap, but broader route/resource-class abuse controls remain part of the production gate.

## V1.8 implementation boundary

| V1.8 area | Repository evidence | Status |
|---|---|---|
| Project list/create and cursor pagination | Project controller/use cases, `CursorPage`, consolidated V1 baseline and frontend Query integration | IMPLEMENTED foundation |
| StoryVersion create | Project story command/persistence and frontend create flow | IMPLEMENTED foundation; per-story rights checkbox removed; legacy StoryVersion rights columns and `content_rights_attestations` are removed by V6/V7 |
| Authentication | Spring Security session/CSRF, password auth, Google OIDC, startup guard, Redis auth limiter | IMPLEMENTED foundation; login/register rate limited; JWT/access/refresh-token migration not yet implemented |
| Analysis enqueue | Generation controller/use case/domain scaffold | **DISABLED BY DEFAULT**; returns `FEATURE_NOT_AVAILABLE` until durable transaction, stage/outbox dispatch, worker claim/lease and reconciliation exist |
| Generation job read | Generation job query/controller | Scaffold/read contract exists; meaningful runtime progress requires durable worker updates |
| Reusable character domain | Character/ProjectCharacter/version/appearance/outfit domain and persistence plus tests | IMPLEMENTED foundation; public REST contract pending |
| Chapter/storyboard model | `Chapter` + `Scene` aggregate roots, `VisualBeat` child entity, Scene lifecycle tests, JPA mappings, ADR-0007 | PARTIAL domain foundation; repositories/application commands/public API pending |
| Frontend runtime data mode | `data-mode.ts`, API default, fixture isolation for test/Storybook | IMPLEMENTED boundary; unsupported production capabilities remain explicit |
| AI worker | Typed provider-neutral schema/ports, untrusted-story boundary, disabled provider | PORT_ONLY; durable intake, lease, storage, media and real adapters pending |
| Safety/notification/entitlement/abuse/deletion | consolidated schema control-plane section | Schema foundation; application executors remain pending |

## P1 production-safety invariants

1. The shared backend artifact has no `spring.profiles.default=local`.
2. With OIDC disabled, only explicit active profiles made exclusively of `local` and/or `test` may start.
3. No profile, `prod`, `production`, `staging`, `qa`, `uat`, preview or any unknown profile must fail startup when OIDC is disabled.
4. PostgreSQL Testcontainers migration verification runs with explicit `test` profile and PostgreSQL datasource/dialect overrides so both the security startup guard and authoritative migration path are exercised in CI.
5. Password login and registration are subject to server-side Redis-backed abuse limits and return `429` + `Retry-After` when exceeded.
6. Story analysis must not return `202 QUEUED` while there is no durable worker execution path.
7. Provider submission must eventually use a dedicated `ProviderOperationStatus` lifecycle with `RESERVED`, `SUBMITTED`, `RUNNING`, `COMPLETED`, `FAILED`, `UNKNOWN`; `UNKNOWN` reconciles before resubmission.
