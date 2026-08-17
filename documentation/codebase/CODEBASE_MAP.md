# NarrativeX Codebase Map

This map describes the current repository and the intended v1.7 growth shape. “Target” entries are contracts, not claims that the scaffold has already implemented them.

## Repository layout

```text
NarrativeX/
├── app/
│   ├── frontend-web/       # Next.js/React web client
│   ├── backend-service/    # Spring Boot modular-monolith boundary
│   └── ai-worker/          # Python 3.12 async AI/media worker
├── documentation/
│   ├── architecture/       # system, data flow, boundaries, stack
│   ├── codebase/           # this map and package ownership
│   └── workflows/          # durable business workflows
├── docker-compose.yml      # local PostgreSQL/Redis/MinIO baseline
├── CONTRIBUTING.md
└── AGENTS.md / AI_CONTEXT.md
```

## Current source tree

### `app/backend-service`

```text
src/main/java/com/narrativex/backend/
├── NarrativeXBackendApplication.java
├── modules/
│   ├── generation/       # job, operation plan, provider operation, stage attempt, API
│   ├── health/           # provider health API
│   ├── project/          # project/story API, entities and repositories
│   └── storyboard/       # chapter/scene/visual-beat domain foundations
├── shared/api/           # API exception handling
├── shared/domain/        # audited persistence primitive
├── configuration/SecurityConfig.java
└── shared/package-info.java
src/main/resources/
├── application.yml
└── db/migration/V1__initial_schema.sql
src/test/
├── java/.../NarrativeXBackendApplicationTests.java
└── resources/application-test.yml
```

`V2__domain_foundation.sql` and the `modules/` packages now provide the first project/story/generation/storyboard foundations; `V3__v17_control_plane.sql` adds the durable v1.7 rights, safety, notification, entitlement, abuse, audit and deletion tables. The full v1.7 domain is still incremental. `application.yml` wires PostgreSQL, Redis and Flyway configuration. `SecurityConfig` currently permits all routes and uses stateless sessions for local scaffolding; production must implement Google OIDC, Secure/HttpOnly/SameSite server sessions and project ownership checks.

### `app/ai-worker`

```text
src/narrativex_worker/
├── __main__.py            # CLI and --dry-run entry point
├── config.py              # Pydantic settings
├── prompting.py           # explicit untrusted-story prompt boundary
├── schema.py              # typed job/provider/safety payloads
├── service.py             # provider-backed worker service boundary
├── providers/              # provider ports and disabled adapter
├── worker.py              # lifecycle runner and graceful stop
└── __init__.py
tests/test_worker.py
pyproject.toml / Dockerfile / .env.example / README.md
```

The current worker still does not claim durable jobs or execute real media providers, but it now has typed payloads, an explicit untrusted-story prompt boundary, a service façade and provider ports/disabled adapter. Target packages should add lease-safe handlers, backend contract client, real provider adapters, storage/media pipeline, usage reporting and reconciliation without moving canonical state ownership into Python.

### `app/frontend-web`

```text
src/
├── app/layout.tsx, page.tsx, globals.css
├── components/ui/index.ts
├── features/index.ts
├── lib/api.ts
└── types/index.ts
```

The current UI is a health/status shell. `lib/api.ts` contains only the API base URL and `types/index.ts` a generic response type. Target feature slices cover auth, projects/story, characters, storyboard/visual review, jobs/SSE, cost/entitlement, notifications, rendering and Shorts.

## Target backend package shape

```text
com.narrativex.backend/
├── auth/ project/ story/ character/ scene/
├── generation/ render/ asset/ shorts/
├── cost/ billing/ entitlement/ provider/
├── safety/ notification/ characterlibrary/
├── configuration/ infrastructure/
└── shared/
```

Each module should keep API/application/domain/persistence concerns local and expose application commands/queries or explicit ports. Vendor SDKs and storage clients belong to infrastructure adapters. Flyway remains backend-owned.

## Cross-repository contracts

- API: authenticated REST commands/queries, `If-Match`/row-version conflicts, idempotency keys and SSE job events.
- Worker contract: claim/heartbeat/complete stage, provider operation evidence, asset validation metadata and resource usage.
- Storage contract: private upload target, temporary object, checksum/HEAD validation, immutable promotion and signed read URL.
- Provider contract: capability-aware estimate/submit/status/reconcile/fetch; external operation ambiguity maps to `UNKNOWN`.
- Event contract: transactional outbox with unique event key for notifications and recovery scans.

## Reading guide

- Architecture decisions and runtime topology: `documentation/architecture/`.
- Current-vs-target code ownership: `documentation/codebase/BACKEND_CODEBASE.md`, `AI_WORKER_CODEBASE.md`, `FRONTEND_CODEBASE.md`.
- User-visible asynchronous journeys: `documentation/workflows/`.
