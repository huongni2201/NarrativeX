# NarrativeX

NarrativeX is an image-first AI Story Video Studio for turning flexible-length stories into consistent, reviewed long-form videos and Short/Reel exports.

## Repository map

| Area | Responsibility |
| --- | --- |
| `app/backend-service` | Spring Boot modular monolith, ownership, domain state, jobs and cost authority |
| `app/ai-worker` | Python AI/media worker, provider ports, QA, TTS and FFmpeg orchestration |
| `app/frontend-web` | Next.js/TypeScript storyboard, review, cost and notification UI |
| `documentation` | Product, domain, architecture, workflows, codebase notes and ADRs |
| `contracts` | Versioned backend ↔ worker payload contracts |
| `docker-compose.yml` | Local PostgreSQL 18, Redis 8, backend and AI worker services; durable media uses external Cloudflare R2 |

## Start the local stack

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

This starts PostgreSQL 18, Redis 8, the Spring Boot backend and the AI worker. Cloudflare R2 is external managed object storage and is not emulated by a local object-storage container. The worker waits for the backend to become healthy so Flyway can apply the PostgreSQL schema first. The backend is available at `http://localhost:8080`; Actuator health is at `http://localhost:8080/actuator/health`.

The worker uses PostgreSQL as its durable work queue. Its safe local default is `AI_PROVIDER_MODE=disabled`, so queued AI jobs fail explicitly until a provider is configured; it never reports fake provider success.

To start only infrastructure dependencies:

```powershell
docker compose up -d postgres redis
```

The backend container uses `postgres` and `redis` as service hostnames. Host-run backend development should continue using `localhost` from `app/backend-service/.env.example`. Media workers use the configured R2 bucket directly for durable media in every environment; worker-local files are scratch/cache only.

PostgreSQL 18 uses a new data directory layout. Do not point it directly at an existing PostgreSQL 16 data volume; migrate retained data with a tested dump/restore or PostgreSQL upgrade procedure first.

The repository uses `V1__initial_schema.sql` as the production Flyway baseline. Deterministic development data lives in `db/local-migration/V3__seed_demo_data.sql`; local-only V4 repairs demo quota reservations so they do not block interactive analysis. These migrations are loaded only when the `local` Spring profile is enabled after the production V2 hardening migration. A fresh production database therefore receives schema plus production-safe hardening only; a local development database also receives the opt-in demo seed and fixture repair. Existing databases created from an older migration history require operator-reviewed recreation or explicit re-baselining; the application does not rewrite `flyway_schema_history` automatically.

Then follow the module READMEs and `CONTRIBUTING.md` for backend, worker, and frontend checks.

### Local Vertex credentials

When `AI_PROVIDER_MODE=vertex`, the worker needs Google Application Default Credentials. Run
`gcloud auth application-default login` once, set `GOOGLE_CLOUD_PROJECT`, and set
`GOOGLE_CLOUD_CONFIG_HOST` in the untracked root `.env` to the host gcloud directory (for example,
`C:/Users/<user>/AppData/Roaming/gcloud`). Compose mounts that directory read-only at the worker's
`GOOGLE_APPLICATION_CREDENTIALS` path. Do not commit credential files.

## Product guardrails

V1.11 is not a fixed-duration or fixed-image-count generator. Planning uses semantic scene boundaries, narration timing, complexity, asset reuse, delta scope, provider capability, and cost reservation. Character identity is versioned and reviewed; external provider outcomes are durable and reconciled; chapter continuation, notifications, entitlement, trust & safety, rights/consent, abuse and privacy gates are part of the product contract, while the current repository remains an incremental foundation.

The canonical source of truth is `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`. Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims when derived documentation drifts.
