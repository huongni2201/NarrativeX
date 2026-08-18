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
| `docker-compose.yml` | Local PostgreSQL 18, Redis 8, MinIO and backend service |

## Start the local stack

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

This starts PostgreSQL 18, Redis 8, MinIO and the Spring Boot backend. The backend is available at `http://localhost:8080`; Actuator health is at `http://localhost:8080/actuator/health`.

To start only infrastructure dependencies:

```powershell
docker compose up -d postgres redis minio
```

The backend container uses `postgres` and `redis` as service hostnames. Host-run backend development should continue using `localhost` from `app/backend-service/.env.example`.

PostgreSQL 18 uses a new data directory layout. Do not point it directly at an existing PostgreSQL 16 data volume; migrate retained data with a tested dump/restore or PostgreSQL upgrade procedure first.

Then follow the module READMEs and `CONTRIBUTING.md` for backend, worker, and frontend checks.

## Product guardrails

V1.8 is not a fixed-duration or fixed-image-count generator. Planning uses semantic scene boundaries, narration timing, complexity, asset reuse, delta scope, provider capability, and cost reservation. Character identity is versioned and reviewed; external provider outcomes are durable and reconciled; chapter continuation, notifications, entitlement, trust & safety, rights/consent, abuse and privacy gates are part of the product contract, while the current repository remains an incremental foundation.

The source of truth for this baseline is the project specification named in `AGENTS.md`.
