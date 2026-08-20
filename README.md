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

The repository uses Flyway versioned migrations (`V1` through `V7`) and repeatable migrations (`R__actual_billing_precision.sql`). When starting with a fresh database or test container, Flyway automatically applies all migrations in sequence. If upgrading from an older volume snapshot, ensure migrations run smoothly or re-initialize the disposable development volume.

Then follow the module READMEs and `CONTRIBUTING.md` for backend, worker, and frontend checks.

## Product guardrails

V1.8 is not a fixed-duration or fixed-image-count generator. Planning uses semantic scene boundaries, narration timing, complexity, asset reuse, delta scope, provider capability, and cost reservation. Character identity is versioned and reviewed; external provider outcomes are durable and reconciled; chapter continuation, notifications, entitlement, trust & safety, rights/consent, abuse and privacy gates are part of the product contract, while the current repository remains an incremental foundation.

The source of truth for this baseline is the project specification named in `AGENTS.md`.
